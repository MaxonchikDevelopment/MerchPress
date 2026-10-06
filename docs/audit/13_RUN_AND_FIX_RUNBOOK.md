# MerchPress: runbook запуска, тестов и исправлений (06 до 11 октября 2026)

Кладётся в `docs/audit/13_RUN_AND_FIX_RUNBOOK.md` и в Knowledge. Приёмочные кейсы лежат в `12_ACCEPTANCE_TESTS.md`, здесь порядок действий, команды и готовые промпты на то, что сломается.

## 1. Кто что делает

| Кто | Что |
|---|---|
| Ты | Мерджи в `main`, ручные тесты по `12`, настройка события в админке, запуск Claude Code |
| Чат (Sonnet 5.5) | Разбор результатов, развилки A/B/C, промпты для Claude Code, обновление документов |
| Claude Code | Разведка, код, автотесты, отчёты `docs/audit/R<n>_REPORT.md` |
| Opus | Только серверная логика (нумерация, Claim, миграции) и безопасность, если автотест показал дефект |

Одна сессия Claude Code на ветку. Следующий промпт запускать только после коммитов предыдущего. Перед каждым промптом `git status` чистый.

## 2. Что где лежит на 06.10 вечер (версия 2)

- `main` (хеш `20051ab` и позже): все запланированные для Гданьска функции смерджены. Очередь с Claim, Ready и отменой, идемпотентное создание заказа, гонка Claim с «Already taken by…», кассовые вкладки «New order» и «Queue» с липкой кнопкой Send, зум принтов, подсказка про Send, новые звуки и «🔔 Test sound», пилюля wake lock, метка версии «build <hash>» на четырёх экранах, диапазон дат события, подтверждения на «Set active» и «Deactivate», подсказки админки. Новых функций больше не делаем.
- База: миграция `0005` (колонка `event_end_date`) применена 06.10 через SQL Editor, бэкап не снимался (миграция только добавляет). Персонал заведён SQL 06.10: 8 Cashier и 3 Press с PIN `0000`, плюс Admin.
- Автотесты: все check-скрипты и живые r1, r2c, r3, r10 зелёные. `r3` повторён на 3 реальных id: гонка Claim между разными людьми на уровне базы доказана. `r2` (функции персонала) не запускался.
- Ветка `gdansk-fix-10`: только отчёт R14, к мерджу после проверки дифстата.
- Не проверено на устройствах: всё, что касается интерфейса, звука, экрана и сети. Это и есть содержание ручного теста.

## 3. График до ивента

| Когда | Что | Результат |
|---|---|---|
| Вт 06.10 вечер | Мердж `gdansk-fix-10`, документы `12` и `13` в репозиторий, настройка Gdańsk в админке (событие, цвета и размеры, макеты) | `main` и документы согласованы, событие активно |
| Ср 07.10 утро | Регрессия T5 на последнем `main` | Все автотесты зелёные |
| Ср 07.10 день | Ручные тесты на ноутбуке: A, B, C, D, E, I, затем G на всех доступных устройствах | Таблицы результатов |
| Ср 07.10 вечер | Ручные тесты F на матрице телефонов, M1 до M4 в виде F2 и D2 | Таблицы результатов |
| Ср 07.10 поздно | Присылаешь заполненные таблицы в чат, получаешь разбор | Список блокеров и промпты T1 до T4 |
| Чт 08.10 утро | Раунд исправлений по блокерам, мердж, смоук J | `main` без открытых блокеров |
| Чт 08.10 15:00 до 20:00 | Монтаж на площадке, раздел L1 (установка на телефоны, звук, версия, площадочный Wi-Fi, запасной интернет) | Все устройства готовы |
| Пт 09.10 8:00 до 21:00 | Подготовка, L2: репетиция 30 минут, смоук J, очистка заказов, вечером заморозка `main` | `main` заморожен |
| Сб 10.10 6:30 и 7:00 | L3: пресс входит первым, на каждой станции утреннее окно H2 | Станции готовы до открытия |
| Сб и Вс 10 и 11.10 | Ивент. L4 в пик, раз в 30 минут запрос на зависшие заказы | |
| Вс 11.10 21:00 до 01:00 | L5: Stats, Export CSV, запись проблем | CSV сохранён |
| После | T7: ретроспектива в репозитории | `14_GDANSK_RETRO.md` |

Если блокер не чинится до пятницы, откат деплоя из раздела 5.

## 4. Рутина мерджа

Один раз на машине: `git config --global core.pager cat` (иначе `(END)` обрывает копипаст).

Перед мерджем смотрим дифстат и сверяем с отчётом. Файл вне ожидаемого списка значит стоп.

```text
cd ~/Desktop/MerchPress
git checkout gdansk-fix-N && git status
git log --oneline main..gdansk-fix-N
git diff --stat main..gdansk-fix-N
git checkout main && git pull
git merge --no-ff gdansk-fix-N -m "Merge gdansk-fix-N: <суть>"
npx tsc -b && npm run lint && npm run build && grep -c "Dev login" dist/assets/*.js
node scripts/<check-скрипт этой ветки>.ts
git push origin main
```

`grep -c` печатает 0 и возвращает код 1, это норма. После пуша Vercel деплоит сам, service worker обновляется сам.

Если мердж даёт конфликт в `docs/audit/11_PHASE_GDANSK.md` (две ветки дописали по строке), оставляем обе строки:

```text
sed -i '' '/^<<<<<<< /d;/^=======$/d;/^>>>>>>> /d' docs/audit/11_PHASE_GDANSK.md
grep -c '<<<<<<<\|>>>>>>>' docs/audit/11_PHASE_GDANSK.md   # ждём 0
git add docs/audit/11_PHASE_GDANSK.md && git commit --no-edit
```

После любого мерджа в `main`, который трогает `src/`, прогнать смоук J из `12` на двух устройствах.

## 5. Откат

Деплоя:

```text
git checkout main && git pull
git log --oneline -8
git revert -m 1 <хеш мердж-коммита> && git push origin main
```

Миграции `0005`: только по отдельному решению, файл `supabase/rollback/0005_event_end_date_rollback.sql` удаляет колонку (потеря введённых конечных дат), сначала должен лежать клиент, который её не пишет.

## 6. Регрессия одной командой

Все автотесты. Живые трогают прод-базу, но только через одноразовые неактивные события `ZZ-*` и чистятся сами. `r2-livetest.mjs` (сценарии персонала) не запускать без `MP_ADMIN_ID` и `MP_ADMIN_PIN` в шелле, он оставляет строку `ZZ-R2-STAFF`, которую можно удалить только SQL.

```text
cd ~/Desktop/MerchPress
for f in scripts/check-*.ts; do echo "== $f"; node "$f" || echo "FAILED $f"; done
node scripts/check-sounds.mjs
node scripts/r1-livetest.mjs
node scripts/r2c-livetest.mjs
node scripts/r3-livetest.mjs
node scripts/r10-livetest.mjs
```

После этого в Supabase SQL Editor проверка, что ничего не осталось:

```sql
select 'events' as t, count(*) from events where name like 'ZZ-%'
union all select 'designs', count(*) from designs where name like 'ZZ-%'
union all select 'users', count(*) from users where name like 'ZZ-%';
```

Ждём нули (кроме `ZZ-R2-STAFF`, если r2 с персоналом когда-то запускали).

## 7. Как проводить ручное тестирование

1. Открыть `12_ACCEPTANCE_TESTS.md`, идти по разделам A, B, C, D, E, G, I на ноутбуке с двумя окнами: обычный Chrome (Press) и инкогнито (Cashier). Админ в третьем окне.
2. Затем раздел F на каждом телефоне матрицы. До этого записать модель, версию ОС, браузер и режим (PWA или вкладка).
3. Затем M1 до M4 (звук, гонка Claim, пилюля wake lock).
4. Тесты идут на событии `ZZ-TEST`, активируется оно только на время теста. Перед настоящим ивентом активным должно быть `Hyrox Gdansk`, заказы чистятся запросом из H1.5.
5. Результат писать прямо в таблицы документа: `ок`, `нет`, `н/п`. Для каждого `нет` три вещи: что нажал, что увидел, на каком устройстве и версии ОС. Если был текст ошибки или тоста, дословно.
6. Присылать в чат заполненные таблицы целиком, не пересказ. Скриншоты только по `нет`.

## 8. Что делать с результатами: разбор и промпты

**Правило:** блокер (`Б`) в состоянии `нет` идёт в раунд исправлений. Остальное в бэклог (раздел 10) с условием возврата.

Сначала в чат, я классифицирую каждый `нет`:

| Класс | Что значит | Куда |
|---|---|---|
| Баг кода | Воспроизводится на любом устройстве | T1, раунд исправлений |
| Платформа | Только на одной модели или версии ОС | T2, разведка, потом развилка |
| Звук и громкость | Слышно плохо | T3 |
| Серверная логика | Дубли, пропуски номеров, гонки | T4, Opus |
| Процесс | Не баг, а инструкция сотрудникам | Правим карточку инструкции, не код |

### T1. Раунд исправлений (Sonnet, Medium)

```text
Read CLAUDE.md and docs/audit/11_PHASE_GDANSK.md first.
Work only in the current MerchPress repo.
Create branch gdansk-fix-<N> off latest main. Verify with git log that main contains the previous fix branch and stop if not.

Important:
- No schema, RLS, RPC or migration change. No SQL. No dependencies.
- Do NOT change the PIN login flow, audio logic, wake lock, polling or queue semantics unless the defect below is in exactly that part.
- Do NOT touch real data and do NOT call activate_event.
- Do NOT push, do NOT merge. Report back first.

Scope (at most two defects, observed on a real device):
<paste from my test table: test id, what was pressed, what was seen, device and OS version, quoted error text>

1. Recon first: write the Recon section of docs/audit/R<next>_REPORT.md (next free number, the latest existing is R14) BEFORE creating or editing any other file, and commit nothing until it exists. Findings with file:line. Say explicitly if the defect cannot be explained from the code.
2. Implement the narrowest fix. Put any pure logic in src/lib with a check script scripts/check-<name>.ts (same runner as scripts/check-merge-orders.ts). Reproduce with a live test only if it needs no browser.
3. Non-goals: everything else.

Validation: tsc -b, npm run lint, npm run build, grep -c "Dev login" dist/assets/*.js must be 0, git grep -n -i "service_role" -- src must be empty, git diff --stat. State explicitly what is not verified on a device.
Commit as 1 commit per defect. Add a short entry to docs/audit/11_PHASE_GDANSK.md. Do not merge, report back first.
```

### T2. Дефект только на части устройств (Sonnet, Low, только чтение)

```text
Read CLAUDE.md first. Work only in the current MerchPress repo. Do not change any file except docs/audit/R<N>_REPORT.md. Do not push, do not merge.

Observed: <test id, device, OS version, browser or PWA mode, what happens, what works on other devices>.

Task: find which code path this touches (file:line). List what in that path depends on platform behavior (Wake Lock, Web Audio or HTMLAudioElement, visibilitychange, Realtime websocket suspension, safe-area insets, sticky positioning with the keyboard, localStorage in standalone mode). For each candidate say what evidence in the code supports or contradicts it. Give exactly two or three fix options with plus and minus, and a recommendation. Do not implement. Do not guess beyond the code.
```

Ответ приходит в чат, я оформляю A/B/C, ты выбираешь, дальше T1.

### T3. Звук (Sonnet, Medium)

```text
Read CLAUDE.md and docs/audit/R5_REPORT.md first. Work only in the current MerchPress repo on a new branch gdansk-fix-<N> off latest main. No schema, SQL, dependencies, audio unlock logic, SoundGate or trigger logic changes. Do not push, do not merge.

Observed: <what was too quiet, too short, too similar, or too harsh, on which device>.
Task: adjust only the generation in scripts/gen-assets.mjs (frequencies, duration, harmonics, repeat count) and update the bounds in scripts/check-sounds.mjs only if the new design demands it. Run node scripts/check-sounds.mjs and paste the real output into docs/audit/R<N>_REPORT.md. State that audibility is verified on devices only.
Commit as 1 commit. Report back first.
```

### T4. Серверная логика (Opus, только чтение сначала)

```text
Read CLAUDE.md, docs/audit/R3_REPORT.md, docs/audit/R2A_REPORT.md and supabase/migrations/0004_ops.sql first. Work only in the current MerchPress repo. Do not change any file except docs/audit/R<N>_REPORT.md. Do not apply SQL, do not run psql, do not push.

Observed (live test output or device): <paste>.
Task: adversarial review of set_order_status, create_order_v2 and the claim and cancel paths for the observed behavior. List each race you can construct with the exact interleaving, whether the current code allows it, and the smallest change that closes it (client only, or a new migration through the two-round pattern). Do not implement.
```

### T5. Регрессия (Sonnet, Low)

```text
Read CLAUDE.md first. Work only in the current MerchPress repo. Do not change any source file.
Run: for f in scripts/check-*.ts, node scripts/check-sounds.mjs, and the live tests r1, r2c, r3, r10 against the real Supabase project. Skip r2-livetest.mjs unless MP_ADMIN_ID and MP_ADMIN_PIN are already set in the shell. Never ask for or print any PIN.
After the live tests run a separate query confirming no ZZ-* event, design or user is left behind (read users through staff_v).
Do NOT call activate_event, do not push, do not merge.
Write docs/audit/R<N>_REPORT.md: one table with script, result, leftover check, anomalies. Commit as 1 commit. Report back.
```

### T6. Заморозка в пятницу

1. T5 зелёный на последнем `main`.
2. Смоук J на двух устройствах, результат одной строкой: дата, хеш `main`, устройства, результат.
3. Запись в `11_PHASE_GDANSK.md`: хеш замороженного `main`.
4. С этого момента в `main` ничего не пушим до конца ивента. Аварийный фикс только после явного решения и только с откатом на готовности.

### T7. Ретроспектива после ивента (Sonnet, Low, документы)

```text
Read CLAUDE.md and docs/audit/11_PHASE_GDANSK.md first. Work only in the current MerchPress repo on a new branch off latest main. Docs only, no source changes.
Input: <paste my notes on what broke or got in the way, the exported CSV summary, results of the on-site tests>.
Write docs/audit/14_GDANSK_RETRO.md with three blocks: what shipped and worked (with commit hashes), what failed or hurt (each with an evidence line), what is deferred with its return condition. Update the backlog section of 11_PHASE_GDANSK.md. Commit as 1 commit. Report back.
```

## 9. Поправки к документу 12 (закрыты в версии 4)

- Цвета макетов советательные: несовместимые затемнены, но выбираются, пустой список совместимых цветов значит «все разрешены». Исправлено в C1.AC3 и C1.4 (в `main` с fix-8).
- Подсказки `title` на телефонах не видны, на тач-экранах тест опирается только на видимый текст (пилюля wake lock теперь показывает нужный текст прямо в надписи).
- Версия 4 добавила: реальный список персонала (раздел 0, A5.5, B1.9), метку версии (B1.10, H1.1, J0), смену людей на устройстве (B1.11), репетицию по расписанию смен (L), реестр автопроверок (M) и SQL-шпаргалки (N).

## 10. Бэклог после Гданьска (возвращается только по условию)

| Пункт | Условие возврата |
|---|---|
| Supabase Auth, аккаунт на человека, RLS по ролям, роль viewer, хеширование PIN и лимит попыток | До Познани (20 до 22.11.2026) |
| Каталог товаров и цены, выручка кастомной печати | После решения по SKU-каталогу основной системы |
| Размеры вне XS до XXL | Если такой бланк реально появится |
| Офлайн-очередь записи | Если на площадке были потери заказов из-за сети |
| Живое обновление дизайнов на станциях | Если правка дизайнов нужна посреди смены |
| Статистика по дням события | Если на двухдневном ивенте нужна разбивка |
| Массовое добавление персонала списком | Если наборов людей станет больше 15 |
| Тесты и CI, отдельный dev-проект Supabase, план Pro с бэкапами | До Познани |
| Настоящие иконки PWA, дизайн звуков | Когда будет логотип |
| Удаление колонки `cashier_key` и старой функции `create_order` | После ивента, когда все устройства на новой версии |
| Web Push для звонка при заблокированном экране | Если Auto-Lock «Never» не приживётся у персонала |

## 11. Следующие шаги по порядку (с вечера 06.10)

1. **Мердж `gdansk-fix-10`** (в нём только отчёт R14). Команды из раздела 4, `N = 10`, скрипт `check-*.ts` запускать не нужно, сборка та же. Ждём файл `docs/audit/R14_REPORT.md`. Конфликт в `11_PHASE_GDANSK.md` лечится по разделу 4.
2. **Документы в репозиторий.** Скопировать `12_ACCEPTANCE_TESTS.md` (перезаписать) и `13_RUN_AND_FIX_RUNBOOK.md` в `docs/audit/`, затем:
   ```text
   cd ~/Desktop/MerchPress
   git checkout main && git pull
   git checkout -b gdansk-docs-1
   git add docs/audit/12_ACCEPTANCE_TESTS.md docs/audit/13_RUN_AND_FIX_RUNBOOK.md
   git commit -m "docs: acceptance tests v4 and run and fix runbook"
   git checkout main && git merge --no-ff gdansk-docs-1 -m "Merge gdansk-docs-1: test protocols"
   git push origin main
   ```
   Файлы также загрузить в Knowledge проекта (прежние версии `12` и `13` заменить).
3. **Настройка события в админке** (A1, A2, A3, A4): `Hyrox Gdansk`, 10.10 до 11.10, цвета и размеры бланков, «Set active», макеты с фото front и back. Персонал уже в базе, проверить его по A5.5.
4. **Регрессия T5** на актуальном `main` (раздел 6), ждёшь зелёные результаты и ноль следов `ZZ-*`.
5. **Ручной прогон** по `12` в порядке раздела 7. Оценка времени: A 40 минут, B 15, C 25, D 20, E 20, I 15, G 30, F по 20 до 30 минут на устройство, смоук J 10. В `12` каждая строка с `Б` это блокер.
6. **Отправка результатов** мне: заполненные таблицы целиком, версии ОС, по каждому `нет` три вещи.
7. **Разбор** (чат, Sonnet): класс каждого `нет`, развилки A/B/C, промпты T1 до T4.
8. **Исправления**: промпт T1 (или T2, если дефект только на части устройств), мердж по разделу 4, смоук J, повтор только упавших пунктов и C3.1, C3.2, D1.2.
9. **Четверг**: L1 на площадке. **Пятница**: L2, T5, T6 (заморозка).
10. **Ивент**: L3, L4, L5. **После**: T7.

Если на любом шаге что-то не сходится с ожидаемым выводом (дифстат, `grep`, хеш), стоп и в чат вывод целиком, без пересказа.

