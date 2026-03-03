# Video Upload Notes (FastEMIs)

## 1) Recommended Method (Agent UI)
Use the agent panel upload page:
- `http://localhost:4200/agent/videos`

Steps:
1. Fill title/priority (optional quote, duration, hero toggle).
2. Choose video file.
3. Click **Upload Video**.

This method automatically:
- saves file,
- creates DB record,
- makes it available for hero/testimonials (based on toggles).

---

## 2) Manual Server Drop Method (Advanced)
If you want to upload manually to server storage, place file in:
- `/Users/biswajitpanda/Desktop/MadLabs/backend/fastEMIsBackend/fastEMIsBackend/media/video/masters/`

Important:
- Copying file alone is **not enough**.
- You must also create a DB row in `TestimonialVideoAsset`.

### Example (Django shell)
Run from:
- `/Users/biswajitpanda/Desktop/MadLabs/backend/fastEMIsBackend/fastEMIsBackend`

```bash
.venv/bin/python manage.py shell
```

```python
from myapp.models import TestimonialVideoAsset

TestimonialVideoAsset.objects.create(
    slug='my_new_video',
    title='My New Video',
    quote='Quick customer story',
    source_file_name='my_new_video.mp4',  # file name inside media/video/masters
    duration_sec=20,
    priority=120,
    is_active=True,
    show_in_hero=False,
)
```

After that, refresh:
- agent videos page (`/agent/videos`), or
- public pages using video manifest (home/testimonials).

---

## 3) Storage and Serving Summary
- Uploaded file model field: `uploaded_video` (upload path: `video/masters`)
- Master source lookup also checks `media/video/masters`
- Public stream endpoint serves final files from:
  - `/media/video/<filename>`

---

## 4) Common Mistake
- File exists in folder but not visible in UI:
  - usually DB entry is missing,
  - or `is_active=False`,
  - or not enabled for hero (`show_in_hero=False`).
