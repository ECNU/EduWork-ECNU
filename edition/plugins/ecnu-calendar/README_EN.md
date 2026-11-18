# ECNU academic calendar

[简体中文](README.md) | **English**

Official calendars from the school’s signed configuration, with a bundled 2026–2027 baseline for autumn, spring and the numbered short summer term, teaching/examination phases, vacations and concrete activities. The public academic-calendar plugin provides semantics and display. Activities become ordinary all-day events; legal holidays never rewrite classes.

Enable `@eduwork/dsh-calendar` and `@eduwork/dsh-academic-calendar` before this package in either DSH or EduWork. Select “华东师范大学 2026-2027 学年校历” in the panel. Week headers show the academic year, term, week and parity; month views show week labels and phase bands. Examination weeks include weekends, vacations have no teaching week, and the short term has weeks 1–4. Selection changes both background and concrete calendar activities.

The school edition inherits calendar, subscriptions, and academic calendar services from its pinned public core. The [edition configuration](../../distribution.json) registers the school calendar data provider and adds the school reference to the calendar management skill.

To add a year or correct holidays, list all years to retain under `configuration.academicCalendars` in the publishing plan. Increment a corrected year's `revision`, retain existing event UIDs, and increment the configuration and overall release revisions. The panel and query tools use the same snapshot on the next launch after download. See the [publishing guide](../../../docs/BUILD.md).

See `data/2026-2027.json` for source attribution. Original examination dates remain intact; whole-week display extends autumn examinations through 2027-01-17 and spring through 2027-06-27. The short term ends 2027-07-23; the published grid marks summer vacation 07-26 through 09-05. Unstated dates are not inferred.

`ctx.ecnuCalendar.describeDate(date)` queries this dataset. Agents use the public `academic_calendar_query` tool. `ready` tracks loading, `integration` tracks registration, and `integrationError` exposes failures. Without the education service the data remains queryable. This package neither accesses school accounts nor makes network requests. Personal timetables use the public structured import interface; personal files are never shipped.
