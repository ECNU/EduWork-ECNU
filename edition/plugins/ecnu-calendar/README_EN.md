# ECNU academic calendar

[简体中文](README.md) | **English**

ECNU's institution-side data layer for the academic calendar: it holds the school's official calendar as structured data and answers date questions derived from it. Teaching and examination weeks are background structure, never calendar events. Once enabled it provides the `ctx.ecnuCalendar` service (`describeDate(date)` answers term, teaching week, odd/even week, phase or break); week-view titles, month-view week numbers and phase bands arrive with the public calendar's display slots (EduWork #186). It reads no school account and makes no network requests.

The 2026–2027 dataset is transcribed from the [official undergraduate calendar](https://bksy.ecnu.edu.cn/b6/33/c40558a767539/page.htm): autumn term starts 2026-09-14 (18 weeks, teaching through 2027-01-01, final exams 2027-01-04 to 01-15), winter vacation 2027-01-18 to 02-20, spring term starts 2027-02-22 (18 weeks, teaching through 2027-06-13, final exams 2027-06-14 to 06-25), short summer term 2027-06-28 to 07-23. Registration and similar dates stay ordinary events. The short summer term carries no week numbers the official calendar does not state, and none are inferred.

The data layout and validation rules live in `data/2026-2027.json`: weeks run seven days from each term's `firstDay`, the last week cut at `lastDay`; week numbering ignores holidays; term, phase and break spans never overlap; everything is validated at load so a bad transcription fails immediately. Field names follow the institution's reading for now and will align with the public format once finalised. Personal timetable access (teaching classes with full meeting lists) arrives in a follow-up institution plugin through the public subscription pipeline.
