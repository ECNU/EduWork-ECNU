# ECNU academic calendar

[简体中文](README.md) | **English**

Enabling this plugin writes the bundled academic year into its own managed source before any Agent conversation. No school account or network request is needed.

The 2026–2027 dataset is transcribed from the [official undergraduate calendar](https://bksy.ecnu.edu.cn/b6/33/c40558a767539/page.htm). It covers teaching/examination weeks, continuing-student registration, winter vacation and the short summer term. Individual courses, holiday adjustments and later notices are outside this dataset. All-day end dates are inclusive.

The public calendar-management Skill receives edition references. The shared calendar is not duplicated per account; future personal timetables use separate account sources. Updates preserve manual events and private settings.

Data revisions retain stable event IDs, increase revision and identify original instances when dates change. An older bundle cannot downgrade a newer cache. This is a local integration pilot; institutional data review and target-product acceptance are required before deployment.

Future fetching, schedules, login and reconnect retries belong to the institution data plugin. There is no network polling or real timetable integration. The public calendar creates due reminder receipts; the product desktop notification channel owns system delivery rather than the institution data plugin.
