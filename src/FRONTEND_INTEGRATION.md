# Hoshang CRM Frontend Integration Guide

Bu hujjat frontendchi uchun backend bilan integratsiya qilishga tayyor, amaliy qo‘llanma.
Hujjat hozirgi kod holatiga mos yozilgan.

## 1. Base Information

- Base API prefix: `/api/`
- Auth type: `JWT Bearer`
- Content type: `application/json`
- Timezone in backend business logic: `Asia/Tashkent`
- Current API pagination: yo‘q
- Current API sorting: backend default ordering bilan ishlaydi
- Current API error format: DRF default JSON format

Frontend barcha protected requestlarda quyidagi headerni yuborishi kerak:

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

## 2. Roles And Access

Uchta rol bor:

- `developer`
- `admin`
- `operator`

Role bo‘yicha access:

| Page / Feature | developer | admin | operator |
|---|---:|---:|---:|
| Login | yes | yes | yes |
| CRM lead list | yes | yes | yes |
| CRM lead detail | yes | yes | yes |
| CRM lead update | yes | yes | yes |
| Lead statuses | yes | yes | yes |
| Users list | yes | yes | no |
| User create | yes | yes | no |
| User update | yes | yes | no |
| User deactivate | yes | yes | no |
| Logs list | yes | yes | no |
| AI settings view | yes | no | no |
| AI settings update | yes | no | no |

Maxsus qoida:

- `admin` developer userlarni ko‘rmaydi
- `admin` developer user yaratolmaydi va update qilolmaydi
- `operator` faqat CRM bilan ishlaydi

## 3. Auth Flow

### 3.1 Login

Endpoint:

```http
POST /api/auth/login/
```

Request body:

```json
{
  "username": "developer",
  "password": "pass12345"
}
```

Success response:

```json
{
  "access": "eyJ...",
  "refresh": "eyJ...",
  "user": {
    "id": 1,
    "username": "developer",
    "first_name": "",
    "last_name": "",
    "email": "",
    "role": "developer",
    "is_active": true,
    "date_joined": "2026-05-18T14:54:00.000000+05:00"
  }
}
```

Frontend flow:

1. Login page `username` va `password` yuboradi.
2. `access` va `refresh` tokenlarni saqlaydi.
3. `user.role` ga qarab route guard ishlaydi.
4. Page refresh bo‘lsa access token bilan ishlash davom etadi.
5. `401` bo‘lsa refresh endpoint orqali token yangilanadi.

### 3.2 Refresh Token

Endpoint:

```http
POST /api/auth/refresh/
```

Request body:

```json
{
  "refresh": "eyJ..."
}
```

Success response:

```json
{
  "access": "eyJ..."
}
```

Frontend tavsiya:

- Har bir `401 Unauthorized` da bir marta refresh urinilsin
- Refresh ham yiqilsa user logout qilinsin
- Infinite retry qilinmasin

### 3.3 Current User

Endpoint:

```http
GET /api/auth/me/
```

Success response:

```json
{
  "id": 2,
  "username": "admin",
  "first_name": "Ali",
  "last_name": "Valiyev",
  "email": "admin@example.com",
  "role": "admin",
  "is_active": true,
  "date_joined": "2026-05-18T15:00:00.000000+05:00"
}
```

Frontend bu endpointni:

- app bootstrap paytida
- token bor bo‘lsa user state ni restore qilishda
- role-based route guard uchun ishlatadi

## 4. CRM Leads

Leadlar AI webhook orqali yaratiladi.
Frontend hozircha lead create qilmaydi.
Frontendning vazifasi:

- lead list ko‘rsatish
- lead detail ko‘rsatish
- lead status va boshqa editable fieldlarni update qilish

### 4.1 Lead Object Shape

Lead response maydonlari:

```json
{
  "id": 15,
  "client_name": "Ali",
  "phone": "+998901112233",
  "branch": "qoyliq",
  "reason": "Operator qo'ng'iroq qilsin",
  "status": "new",
  "source": "instagram",
  "external_user_id": "178900000001",
  "external_thread_id": "mid.1234567890",
  "last_ai_reply": "Rahmat, ma’lumotlaringizni operatorlarimizga yubordim.",
  "created_by_ai": true,
  "created_at": "2026-05-18T15:30:00.000000+05:00",
  "updated_at": "2026-05-18T15:30:00.000000+05:00"
}
```

### 4.2 Lead List

Endpoint:

```http
GET /api/leads/
```

Response:

```json
[
  {
    "id": 15,
    "client_name": "Ali",
    "phone": "+998901112233",
    "branch": "center",
    "reason": "Operator bog'lansin",
    "status": "new",
    "source": "instagram",
    "external_user_id": "178900000001",
    "external_thread_id": "mid.123",
    "last_ai_reply": "Rahmat, ma’lumotlaringizni operatorlarimizga yubordim.",
    "created_by_ai": true,
    "created_at": "2026-05-18T15:30:00.000000+05:00",
    "updated_at": "2026-05-18T15:30:00.000000+05:00"
  }
]
```

Muhim:

- Pagination yo‘q, response plain array
- Default ordering: `created_at desc`

### 4.3 Lead Filters

Lead list query params:

- `status`
- `branch`
- `search`
- `date_from`
- `date_to`

Example:

```http
GET /api/leads/?status=new&branch=center&search=ali&date_from=2026-05-01&date_to=2026-05-31
```

Filter behavior:

- `status`: exact match
- `branch`: exact match
- `search`: `client_name`, `phone`, `reason` bo‘yicha case-insensitive contains
- `date_from`: `created_at__date >= value`
- `date_to`: `created_at__date <= value`

Date format:

```text
YYYY-MM-DD
```

### 4.4 Lead Detail

Endpoint:

```http
GET /api/leads/{id}/
```

Example:

```http
GET /api/leads/15/
```

Response:

Lead object shape bilan bir xil.

### 4.5 Lead Update

Endpoint:

```http
PATCH /api/leads/{id}/
```

Editable fields:

- `client_name`
- `phone`
- `branch`
- `reason`
- `status`

Request example:

```json
{
  "status": "contacted",
  "reason": "Mijoz bilan bog'lanildi, qayta qo'ng'iroq kerak"
}
```

Success response:

```json
{
  "id": 15,
  "client_name": "Ali",
  "phone": "+998901112233",
  "branch": "center",
  "reason": "Mijoz bilan bog'lanildi, qayta qo'ng'iroq kerak",
  "status": "contacted",
  "source": "instagram",
  "external_user_id": "178900000001",
  "external_thread_id": "mid.123",
  "last_ai_reply": "Rahmat, ma’lumotlaringizni operatorlarimizga yubordim.",
  "created_by_ai": true,
  "created_at": "2026-05-18T15:30:00.000000+05:00",
  "updated_at": "2026-05-18T15:40:00.000000+05:00"
}
```

Backend audit behavior:

- Agar `status` o‘zgarsa audit action `status_change`
- Boshqa fieldlar o‘zgarsa audit action `update`

### 4.6 Lead Status Options

Endpoint:

```http
GET /api/leads/statuses/
```

Response:

```json
[
  { "value": "new", "label": "New" },
  { "value": "contacted", "label": "Contacted" },
  { "value": "in_progress", "label": "In Progress" },
  { "value": "follow_up", "label": "Follow Up" },
  { "value": "won", "label": "Won" },
  { "value": "lost", "label": "Lost" }
]
```

Frontend tavsiya:

- Status dropdown aynan shu endpointdan olinsin
- Hardcode qilish shart emas

### 4.7 Branch Values

Frontend valid branch values:

- `center`
- `family`
- `qoyliq`

Tavsiya etiladigan label mapping:

- `center` → `Center`
- `family` → `Family`
- `qoyliq` → `Ada / Qoyliq`

## 5. Users Management

Bu blok faqat `developer` va `admin` uchun.

### 5.1 User Object Shape

```json
{
  "id": 4,
  "username": "operator1",
  "first_name": "Vali",
  "last_name": "Aliyev",
  "email": "operator1@example.com",
  "role": "operator",
  "is_active": true,
  "date_joined": "2026-05-18T16:00:00.000000+05:00"
}
```

### 5.2 Users List

Endpoint:

```http
GET /api/users/
```

Response:

Plain JSON array of users.

Admin behavior:

- `developer` userlar response ga kirmaydi

Developer behavior:

- hamma userlar keladi

### 5.3 Create User

Endpoint:

```http
POST /api/users/
```

Request body:

```json
{
  "username": "operator2",
  "first_name": "Hasan",
  "last_name": "Karimov",
  "email": "operator2@example.com",
  "role": "operator",
  "is_active": true,
  "password": "StrongPassword123"
}
```

Success response:

```json
{
  "id": 7,
  "username": "operator2",
  "first_name": "Hasan",
  "last_name": "Karimov",
  "email": "operator2@example.com",
  "role": "operator",
  "is_active": true,
  "date_joined": "2026-05-18T16:15:00.000000+05:00"
}
```

Muhim:

- `password` response ga qaytmaydi
- `admin` `developer` role yaratmoqchi bo‘lsa `400`

### 5.4 User Detail

Endpoint:

```http
GET /api/users/{id}/
```

Response:

User object shape bilan bir xil.

### 5.5 User Update

Endpoint:

```http
PATCH /api/users/{id}/
```

Editable fields:

- `username`
- `first_name`
- `last_name`
- `email`
- `role`
- `is_active`
- `password`

Request example:

```json
{
  "first_name": "Yangi ism",
  "password": "NewStrongPassword123"
}
```

Muhim:

- `password` optional
- yuborilsa backend hash qiladi
- `admin` developer role ga update qilolmaydi

### 5.6 User Delete

Endpoint:

```http
DELETE /api/users/{id}/
```

Amaldagi behavior:

- Bu hard delete emas
- Backend `is_active = false` qilib qo‘yadi

Frontend tavsiya:

- UI da buni `Deactivate user` deb ko‘rsatish to‘g‘riroq

## 6. Logs Page

Bu blok faqat `developer` va `admin` uchun.

### 6.1 Log Object Shape

```json
{
  "id": 55,
  "actor": {
    "id": 2,
    "username": "admin",
    "first_name": "Ali",
    "last_name": "Valiyev",
    "email": "admin@example.com",
    "role": "admin",
    "is_active": true,
    "date_joined": "2026-05-18T15:00:00.000000+05:00"
  },
  "target_type": "Lead",
  "target_id": "15",
  "target_repr": "Ali (+998901112233)",
  "action": "status_change",
  "field_changes": {
    "status": {
      "old": "new",
      "new": "contacted"
    }
  },
  "created_at": "2026-05-18T16:30:00.000000+05:00"
}
```

### 6.2 Logs List

Endpoint:

```http
GET /api/logs/
```

Response:

Plain JSON array of logs.

### 6.3 Log Filters

Query params:

- `target_type`
- `actor`
- `date_from`
- `date_to`

Example:

```http
GET /api/logs/?target_type=Lead&actor=2&date_from=2026-05-01&date_to=2026-05-31
```

Expected `target_type` examples:

- `Lead`
- `User`
- `AIConfig`

Expected `action` values:

- `create`
- `update`
- `delete`
- `status_change`

## 7. AI Settings Page

Bu blok faqat `developer` uchun.

### 7.1 Active AI Config Get

Endpoint:

```http
GET /api/ai-settings/active/
```

Response:

```json
{
  "id": 1,
  "system_prompt": "HOSHANG OPERATOR CONNECT PROMPT ...",
  "openai_api_key": "sk-...",
  "model_name": "gpt-4.1",
  "temperature": 0.7,
  "max_tokens": 500,
  "is_active": true,
  "created_at": "2026-05-18T15:10:00.000000+05:00",
  "updated_at": "2026-05-18T16:40:00.000000+05:00"
}
```

### 7.2 Active AI Config Update

Endpoint:

```http
PATCH /api/ai-settings/active/
```

Editable fields:

- `system_prompt`
- `openai_api_key`
- `model_name`
- `temperature`
- `max_tokens`

Request example:

```json
{
  "system_prompt": "New prompt text",
  "openai_api_key": "sk-new-key",
  "model_name": "gpt-4.1",
  "temperature": 0.6,
  "max_tokens": 700
}
```

Success response:

AI config object bilan bir xil.

Frontend tavsiya:

- `system_prompt` uchun large textarea/editor ishlating
- `openai_api_key` uchun password-like masked input ishlating
- `temperature` number input yoki slider bo‘lishi mumkin
- `max_tokens` integer-only input bo‘lsin

## 8. Validation And Known Backend Constraints

Hozirgi backendda quyidagi narsalar muhim:

- `role` faqat:
  - `developer`
  - `admin`
  - `operator`
- `branch` faqat:
  - `center`
  - `family`
  - `qoyliq`
- `status` faqat:
  - `new`
  - `contacted`
  - `in_progress`
  - `follow_up`
  - `won`
  - `lost`

Field practical expectations:

- `username`: unique
- `password`: create paytida required
- `phone`: backendda maxsus format validator yo‘q, frontend o‘zi format nazorat qilsa yaxshi
- `temperature`: float
- `max_tokens`: integer

## 9. Error Handling

Backend DRF default error format qaytaradi.

### 9.1 Unauthorized

```json
{
  "detail": "Authentication credentials were not provided."
}
```

Yoki:

```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid",
  "messages": [
    {
      "token_class": "AccessToken",
      "token_type": "access",
      "message": "Token is invalid or expired"
    }
  ]
}
```

### 9.2 Forbidden

```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 9.3 Validation Error

```json
{
  "role": [
    "Admin cannot manage developer users."
  ]
}
```

Yoki:

```json
{
  "username": [
    "A user with that username already exists."
  ]
}
```

Frontend tavsiya:

- `detail` bo‘lsa toast/modalda ko‘rsatish
- field-level error bo‘lsa form input ostida ko‘rsatish
- `401` va `403` ni alohida handle qilish

## 10. Recommended Frontend Page Mapping

### 10.1 Login Page

Kerakli fieldlar:

- `username`
- `password`

Successdan keyin:

- `developer`:
  - CRM
  - Users
  - Logs
  - AI Settings
- `admin`:
  - CRM
  - Users
  - Logs
- `operator`:
  - CRM

### 10.2 CRM Page

Tavsiya etiladigan bloklar:

- top summary strip
  - optional, frontend o‘zi hisoblaydi
- filter bar
  - status
  - branch
  - date range
  - search
- leads table/list
  - id
  - client_name
  - phone
  - branch
  - status
  - reason preview
  - created_at
  - updated_at
- side panel yoki modal
  - full reason
  - AI last reply
  - editable status
  - editable client data

### 10.3 Users Page

Tavsiya:

- users table
- create user modal
- edit user modal
- deactivate action
- role badge
- `admin` uchun developerlar umuman ko‘rinmaydi

### 10.4 Logs Page

Tavsiya:

- actor filter
- target type filter
- date range filter
- table columns:
  - created_at
  - actor.username
  - target_type
  - target_repr
  - action
- expanded row:
  - `field_changes` JSON human-readable diff

### 10.5 AI Settings Page

Tavsiya:

- `system_prompt` editor
- `openai_api_key` masked input
- `model_name` text/select
- `temperature` numeric input
- `max_tokens` numeric input
- save button

## 11. Frontend State Recommendations

Tavsiya etiladigan global state:

- `auth`
  - access token
  - refresh token
  - current user
- `permissions`
  - derived from `user.role`
- `crmFilters`
  - status
  - branch
  - search
  - date range

Tavsiya etiladigan route guards:

- not authenticated → login
- authenticated but wrong role → 403 page yoki redirect

## 12. Current Backend Limitations

Frontendchi bilishi kerak bo‘lgan amaldagi cheklovlar:

- Pagination yo‘q
- Sort param yo‘q
- Bulk update yo‘q
- Bulk delete yo‘q
- Lead create endpoint yo‘q
- Conversation view endpoint yo‘q
- File upload endpointlar bu CRM API hujjat scope idan tashqarida
- `openai_api_key` GET response ichida plain text qaytadi

Oxirgi punkt muhim:

- bu backend behavior xavfsizlik nuqtai nazaridan keyin mask yoki write-only qilish bilan kuchaytirilishi mumkin
- hozirgi kod holatida frontend bu qiymatni to‘liq oladi

## 13. Suggested Frontend Delivery Order

1. Login + token refresh
2. Role-based layout shell
3. CRM lead list + filters
4. CRM lead detail + patch update
5. Users page
6. Logs page
7. AI settings page

## 14. Quick Endpoint Summary

### Auth

- `POST /api/auth/login/`
- `POST /api/auth/refresh/`
- `GET /api/auth/me/`

### Leads

- `GET /api/leads/`
- `GET /api/leads/{id}/`
- `PATCH /api/leads/{id}/`
- `GET /api/leads/statuses/`

### Users

- `GET /api/users/`
- `POST /api/users/`
- `GET /api/users/{id}/`
- `PATCH /api/users/{id}/`
- `DELETE /api/users/{id}/`

### Logs

- `GET /api/logs/`

### AI Settings

- `GET /api/ai-settings/active/`
- `PATCH /api/ai-settings/active/`
