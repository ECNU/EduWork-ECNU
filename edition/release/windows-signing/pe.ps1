# Classify native binaries without loading or executing them. Broken PE headers
# must fail closed rather than becoming an exception to signature inventory.
function Test-WindowsPE([string]$Path) {
  $reader = [IO.BinaryReader]::new([IO.File]::OpenRead($Path))
  try {
    $dos = $reader.ReadBytes(64)
    if ($dos.Length -lt 2 -or $dos[0] -ne 0x4d -or $dos[1] -ne 0x5a) {
      $magic = if ($dos.Length -ge 4) { [Convert]::ToHexString($dos,0,4) } else { '' }
      # ELF and thin/universal Mach-O variants can ship as optional .node modules.
      if ($magic -in @('7F454C46','CEFAEDFE','FEEDFACE','CFFAEDFE','FEEDFACF','CAFEBABE','BEBAFECA','CAFEBABF','BFBAFECA')) { return $false }
      throw "Unrecognized native binary header: $Path"
    }
    if ($dos.Length -ne 64) { throw "Malformed PE DOS header: $Path" }
    $offset = [BitConverter]::ToUInt32($dos,60)
    if ($offset -lt 64 -or [long]$offset + 24 -gt $reader.BaseStream.Length) { throw "Malformed PE header offset: $Path" }
    $reader.BaseStream.Position = $offset
    $coff = $reader.ReadBytes(24)
    if ([BitConverter]::ToUInt32($coff,0) -ne 0x00004550) { throw "Malformed PE signature: $Path" }
    $sections = [BitConverter]::ToUInt16($coff,6)
    $optionalSize = [BitConverter]::ToUInt16($coff,20)
    $sectionTable = [long]$offset + 24 + $optionalSize
    if (!$sections -or $optionalSize -lt 2 -or $sectionTable + 40 * $sections -gt $reader.BaseStream.Length) { throw "Malformed PE header bounds: $Path" }
    $optionalMagic = $reader.ReadUInt16()
    $minimum = switch ($optionalMagic) { 0x10b { 96 }; 0x20b { 112 }; default { throw "Malformed PE optional header: $Path" } }
    if ($optionalSize -lt $minimum) { throw "Malformed PE optional header size: $Path" }
    for ($index = 0; $index -lt $sections; $index++) {
      $reader.BaseStream.Position = $sectionTable + 40 * $index
      $section = $reader.ReadBytes(40)
      $rawSize = [BitConverter]::ToUInt32($section,16)
      $rawOffset = [BitConverter]::ToUInt32($section,20)
      if ($rawSize -and (!$rawOffset -or [long]$rawOffset + $rawSize -gt $reader.BaseStream.Length)) { throw "Malformed PE section bounds: $Path" }
    }
    return $true
  } finally { $reader.Dispose() }
}
