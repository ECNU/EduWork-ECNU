"""Exercise the published bundles, updater and real release Ed25519 key on disposable Macs."""
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import platform
import plistlib
import shutil
import ssl
import subprocess
import threading
import xml.etree.ElementTree as ET

repo = Path.cwd()
work = Path(os.environ['RUNNER_TEMP']) / 'migration'
work.mkdir()
os.chdir(work)
arch = 'arm64' if platform.machine() == 'arm64' else 'x64'
inputs = json.loads((repo / 'edition/test/qa-sparkle-inputs.json').read_bytes())[arch]
namespace = 'http://www.andymatuschak.org/xml-namespaces/sparkle'
ET.register_namespace('sparkle', namespace)

def run(*args, **kwargs):
    return subprocess.run(list(map(str, args)), check=True, **kwargs)

def download(url, path, sha):
    run('curl', '--fail', '--silent', '--show-error', '--location', '--retry', '3', '-o', path, url)
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(block)
    assert digest.hexdigest() == sha

download(inputs['base']['url'], 'base.zip', inputs['base']['sha256'])
download(inputs['target']['url'], 'update.zip', inputs['target']['sha256'])
run('ditto', '-x', '-k', 'base.zip', 'installed')
app = work / 'installed/EduWork-ECNU.app'
plist = app / 'Contents/Info.plist'
before = plistlib.loads(plist.read_bytes())
assert before['CFBundleVersion'] == '0.4.12'
assert 'Signature=adhoc' in run('codesign','-dvvv',app,capture_output=True,text=True).stderr

cli_app = work / 'Sparkle CLI.app/Contents'
cli = cli_app / 'MacOS/sparkle-cli'
cli.parent.mkdir(parents=True)
frameworks = cli_app / 'Frameworks'
frameworks.mkdir()
run('ditto', app / 'Contents/Frameworks/Sparkle.framework', frameworks / 'Sparkle.framework')
src = repo / 'sparkle-src'
include = work / 'include/Sparkle'
include.mkdir(parents=True)
for file in ['InstallerLauncher/SUInstallerLauncher+Private.h','Sparkle/SPUUserAgent+Private.h']:
    shutil.copy(src / file, include)
(cli_app / 'Info.plist').write_bytes(plistlib.dumps(dict(CFBundleExecutable='sparkle-cli', CFBundleIdentifier='org.eduwork.migration-test', CFBundlePackageType='APPL', CFBundleVersion='1', LSBackgroundOnly=True)))
run('clang++','-fobjc-arc','-DSPU_OBJC_DIRECT=','-DSPU_OBJC_DIRECT_MEMBERS=','-I',include.parent,'-F',frameworks,'-framework','Sparkle','-framework','Cocoa','-Wl,-rpath,@executable_path/../Frameworks',*[src / 'sparkle-cli' / name for name in ['main.m','SPUCommandLineDriver.m','SPUCommandLineUserDriver.m']],'-o',cli)
run('codesign','--force','--deep','--sign','-','--timestamp=none',cli_app.parent)

# Trust a local TLS certificate on the disposable runner for the test feed only.
Path('ca.cnf').write_text('[req]\nprompt=no\ndistinguished_name=dn\nx509_extensions=ca\n[dn]\nCN=EduWork test CA\n[ca]\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\n')
Path('leaf.cnf').write_text('[tls]\nsubjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n')
run('openssl','req','-x509','-newkey','rsa:2048','-nodes','-keyout','ca.key','-out','ca.crt','-days','1','-config','ca.cnf')
run('openssl','req','-new','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=localhost')
run('openssl','x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','1','-extfile','leaf.cnf','-extensions','tls')
run('sudo','security','add-trusted-cert','-d','-r','trustRoot','-k','/Library/Keychains/System.keychain','ca.crt')
public = work / 'feed'
public.mkdir()
(work / 'update.zip').rename(public / 'update.zip')
requests = []
class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        requests.append(self.path)
        return super().do_GET()
server = http.server.ThreadingHTTPServer(('127.0.0.1',0), functools.partial(Handler,directory=str(public)))
tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
tls.load_cert_chain('server.crt','server.key')
server.socket = tls.wrap_socket(server.socket, server_side=True)
threading.Thread(target=server.serve_forever,daemon=True).start()
origin = f'https://localhost:{server.server_port}'
feed = ET.Element('rss',version='2.0')
channel = ET.SubElement(feed,'channel'); ET.SubElement(channel,'title').text='Migration test'
item = ET.SubElement(channel,'item'); ET.SubElement(item,'title').text='0.4.13'
ET.SubElement(item,f'{{{namespace}}}version').text = '0.4.13'
ET.SubElement(item,'enclosure',url=origin+'/update.zip',length=str(inputs['target']['size']),type='application/octet-stream',attrib={f'{{{namespace}}}edSignature': inputs['target']['edSignature']})
feedfile = public / 'appcast.xml'
def upgrade(target):
    ET.ElementTree(feed).write(feedfile,encoding='utf-8',xml_declaration=True)
    requests.clear()
    run(cli,target,'--check-immediately','--feed-url',origin+'/appcast.xml','--user-agent-name','EduWork migration QA','--verbose',timeout=420)
    installed = plistlib.loads((target / 'Contents/Info.plist').read_bytes())
    assert installed['CFBundleVersion'] == '0.4.13'
    assert all(installed[k]==before[k] for k in ['CFBundleIdentifier','SUPublicEDKey','SUFeedURL'])
    run('codesign','--verify','--deep','--strict',target)
    assert 'TeamIdentifier=9TM4966M82' in run('codesign','-dvvv',target,capture_output=True,text=True).stderr
    run('xcrun','stapler','validate',target)
    run('spctl','--assess','--type','execute',target)
    return list(requests)

full_requests = upgrade(app)
assert '/update.zip' in full_requests
print('PASS real 0.4.12 to signed 0.4.13 full update:',arch,full_requests,flush=True)
if 'wrongBaseDelta' in inputs:
    # Offer a genuine signed patch made from a different base in this local feed
    # to exercise full ZIP fallback without modifying either released app.
    delta = inputs['wrongBaseDelta']
    download(delta['url'], public/'mismatch.delta',delta['sha256'])
    run('ditto','-x','-k','base.zip','fallback')
    entry=ET.SubElement(ET.SubElement(item,f'{{{namespace}}}deltas'),'enclosure',url=origin+'/mismatch.delta',length=str(delta['size']),type='application/octet-stream',attrib={f'{{{namespace}}}deltaFrom':'0.4.12',f'{{{namespace}}}edSignature':delta['edSignature']})
    calls=upgrade(work/'fallback/EduWork-ECNU.app');assert '/mismatch.delta' in calls and '/update.zip' in calls and calls.index('/mismatch.delta') < calls.index('/update.zip')
    print('PASS mismatched delta falls back to signed full ZIP:',calls,flush=True)
