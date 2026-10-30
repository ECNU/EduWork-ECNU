# ECNU academic calendar

[简体中文](README.md) | **English**

Official ECNU 2026–2027 data for autumn, spring and the numbered short summer term, teaching/examination phases, vacations and concrete activities. The public academic-calendar plugin provides semantics and display. Activities become ordinary all-day events; legal holidays never rewrite classes.

Enable `@eduwork/dsh-calendar` and `@eduwork/dsh-academic-calendar` before this package in either DSH or EduWork. Select “ECNU 2026-2027 本科校历” in the panel. Week headers show the academic year, term, week and parity; month views show week labels and phase bands. Examination weeks include weekends, vacations have no teaching week, and the short term has weeks 1–4. Selection changes both background and concrete calendar activities.

See `data/2026-2027.json` for source attribution. Original examination dates remain intact; whole-week display extends autumn examinations through 2027-01-17 and spring through 2027-06-27. The short term ends 2027-07-23; the published grid marks summer vacation 07-26 through 09-05. Unstated dates are not inferred.

`ctx.ecnuCalendar.describeDate(date)` queries this dataset. Agents use the public `academic_calendar_query` tool. `ready` tracks loading, `integration` tracks registration, and `integrationError` exposes failures. Without the education service the data remains queryable. This package neither accesses school accounts nor makes network requests. Personal timetables use the public structured import interface; personal files are never shipped.
