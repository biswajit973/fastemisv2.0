from datetime import timedelta
import json
import logging
import mimetypes
import os
import re
import shutil
import time
from pathlib import Path
from django.db import IntegrityError, transaction
from django.db.models import Count, F, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, Concat
from django.core.files.base import ContentFile
from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from .serializers import *
from .models import *
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
# Create your views here.

AGENT_USERNAME = "Agent"
AGENT_PASSCODE = "787978"
AGENT_EMAIL = "kratos.agent@fastemis.local"
GLOBAL_PAYMENT_VALIDITY_MINUTES = 5
MAX_ACTIVE_GLOBAL_ANNOUNCEMENTS = 2
MAX_ACTIVE_PRIVATE_ANNOUNCEMENTS_PER_USER = 2
COMMUNITY_SAFETY_RULES = [
    'Do not share personal contact details like phone number or email.',
    'Do not request or disclose sensitive personal information.',
    'Messages with restricted contact details are masked for safety.'
]
VIDEO_MANIFEST_VERSION = 'v1'
VIDEO_MANIFEST_CACHE_TTL_SEC = 300
VIDEO_STREAM_CACHE_SECONDS = 31536000
VIDEO_ASSET_SCAN_MIN_INTERVAL_SEC = 45
VIDEO_MANIFEST_BUILD_CACHE_SEC = 20
VIDEO_RANGE_PATTERN = re.compile(r'^bytes=(\d*)-(\d*)$')
VIDEO_SLUG_PATTERN = re.compile(r'[^a-z0-9_-]+')

PUBLIC_VIDEO_CATALOG = [
    {
        'id': 'ratikanta',
        'source_file': 'Ratikanta.mp4',
        'title': 'Ratikanta M.',
        'quote': 'The instant EMI process entirely online changed everything. No branch visits!',
        'duration_sec': 24,
        'priority': 10,
        'active': True
    },
    {
        'id': 'monica',
        'source_file': 'monica.mp4',
        'title': 'Monica S.',
        'quote': 'Approved in minutes and I bought my MacBook immediately. Flawless.',
        'duration_sec': 20,
        'priority': 20,
        'active': True
    },
    {
        'id': 'sreekanth',
        'source_file': 'sreekanth.mp4',
        'title': 'Sreekanth P.',
        'quote': 'No waiting lines! FastEMIs connected me to the best partner seamlessly.',
        'duration_sec': 30,
        'priority': 30,
        'active': True
    },
    {
        'id': 'ritika',
        'source_file': 'ritika.mp4',
        'title': 'Ritika K.',
        'quote': 'The transparent fees and instant approval saved me so much hassle.',
        'duration_sec': 28,
        'priority': 40,
        'active': True
    },
    {
        'id': 'rudra',
        'source_file': 'Rudra.mp4',
        'title': 'Rudra T.',
        'quote': 'I was skeptical, but the zero hidden fees part is 100 percent real.',
        'duration_sec': 24,
        'priority': 50,
        'active': True
    },
    {
        'id': 'damayanti',
        'source_file': 'Damayanti Nayak.mp4',
        'title': 'Damayanti N.',
        'quote': 'Super fast approval and great customer service. Highly recommended!',
        'duration_sec': 24,
        'priority': 60,
        'active': True
    },
    {
        'id': 'jayakrishna',
        'source_file': 'Jayakrishna Goswami.mp4',
        'title': 'Jayakrishna G.',
        'quote': 'I got my mobile phone on EMI without a credit card. Amazing service.',
        'duration_sec': 25,
        'priority': 70,
        'active': True
    },
    {
        'id': 'maya',
        'source_file': 'Maya Sa.mp4',
        'title': 'Maya S.',
        'quote': 'The whole process is paperless and very straightforward. Thank you FastEMIs.',
        'duration_sec': 22,
        'priority': 80,
        'active': True
    },
    {
        'id': 'nayan',
        'source_file': 'Nayan Sharma.mp4',
        'title': 'Nayan S.',
        'quote': 'Flexible repayment options made my large purchase easy to manage.',
        'duration_sec': 23,
        'priority': 90,
        'active': True
    },
    {
        'id': 'padmanava',
        'source_file': 'Padmanava Rao.mp4',
        'title': 'Padmanava R.',
        'quote': 'Trustworthy and transparent. I will definitely use this again.',
        'duration_sec': 26,
        'priority': 100,
        'active': True
    },
    {
        'id': 'preetam',
        'source_file': 'Preetam Das.mp4',
        'title': 'Preetam D.',
        'quote': 'Checked my eligibility in seconds. The quickest processing ever.',
        'duration_sec': 24,
        'priority': 110,
        'active': True
    },
    {
        'id': 'rohit',
        'source_file': 'Rohit.mp4',
        'title': 'Rohit K.',
        'quote': 'Upgraded my appliances with zero down payment. Brilliant.',
        'duration_sec': 21,
        'priority': 120,
        'active': True
    },
    {
        'id': 'joseph',
        'source_file': 'josephKerala.mp4',
        'title': 'Joseph K.',
        'quote': 'Very impressed with the security and the speed of disbursement.',
        'duration_sec': 22,
        'priority': 130,
        'active': True
    },
    {
        'id': 'payal',
        'source_file': 'payal Khemka.mp4',
        'title': 'Payal K.',
        'quote': 'The interface is beautiful and very simple to navigate.',
        'duration_sec': 22,
        'priority': 140,
        'active': True
    },
    {
        'id': 'subhaprada',
        'source_file': 'subhaprada.mp4',
        'title': 'Subhaprada P.',
        'quote': 'I recommend FastEMIs to my friends. Truly future-ready payments.',
        'duration_sec': 23,
        'priority': 150,
        'active': True
    }
]
HERO_VIDEO_IDS = {'ratikanta', 'monica', 'sreekanth', 'ritika', 'rudra', 'damayanti', 'jayakrishna', 'payal'}

VIDEO_CATALOG_VERIFIED = False
VIDEO_CATALOG_LAST_SCAN_TS = 0.0
VIDEO_ASSET_LAST_STATUS = {
    'ready': 0,
    'total': len(PUBLIC_VIDEO_CATALOG),
    'missing_sources': []
}
VIDEO_MANIFEST_CACHE: dict[tuple[str, str], dict] = {}
VIDEO_LOGGER = logging.getLogger(__name__)

RESTRICTED_EMAIL_PATTERN = re.compile(r'([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})')
RESTRICTED_PHONE_PATTERN = re.compile(r'(?<!\d)(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){10,12}(?!\d)')

DEFAULT_COMMUNITY_PERSONAS = [
    {
        'display_name': 'Aarav Helper',
        'ghost_id': 'aarav_helper',
        'identity_tag': 'friendly_helper',
        'info': 'Friendly EMI buddy for quick help.',
        'avatar_url': '',
        'short_bio': 'Friendly EMI buddy for quick help.',
        'tone_guidelines': 'Warm, simple, supportive.',
        'sort_order': 10
    },
    {
        'display_name': 'Sana Guide',
        'ghost_id': 'sana_guide',
        'identity_tag': 'process_guide',
        'info': 'Answers process and document questions.',
        'avatar_url': '',
        'short_bio': 'Answers process and document questions.',
        'tone_guidelines': 'Calm, clear, reassuring.',
        'sort_order': 20
    },
    {
        'display_name': 'Rafiq Tech',
        'ghost_id': 'rafiq_tech',
        'identity_tag': 'tech_support',
        'info': 'Helps with upload and status issues.',
        'avatar_url': '',
        'short_bio': 'Helps with upload and status issues.',
        'tone_guidelines': 'Practical, step-by-step.',
        'sort_order': 30
    }
]


def _project_root() -> Path:
    base = Path(settings.BASE_DIR).resolve()
    # /<repo>/backend/fastEMIsBackend/fastEMIsBackend -> /<repo>
    return base.parents[2] if len(base.parents) >= 3 else base


def _video_root_dir() -> Path:
    return (Path(settings.MEDIA_ROOT) / 'video').resolve()


def _desktop_variant_name(video_id: str) -> str:
    return f'{video_id}.{VIDEO_MANIFEST_VERSION}.desktop.mp4'


def _mobile_variant_name(video_id: str) -> str:
    return f'{video_id}.{VIDEO_MANIFEST_VERSION}.mobile.mp4'


def _poster_variant_name(video_id: str) -> str:
    return f'{video_id}.{VIDEO_MANIFEST_VERSION}.poster.svg'


def _candidate_source_paths(source_name: str) -> list[Path]:
    root = _project_root()
    return [
        _video_root_dir() / 'masters' / source_name,
        root / 'src' / 'app' / 'mediaFiles' / 'customervideos' / source_name,
        root / source_name,
    ]


def _find_source_video(source_name: str) -> Path | None:
    if not str(source_name or '').strip():
        return None
    for path in _candidate_source_paths(source_name):
        if path.exists() and path.is_file():
            return path
    return None


def _link_or_copy_file(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        return
    try:
        os.link(source, target)
        return
    except Exception:
        pass
    shutil.copy2(source, target)


def _safe_svg_text(raw: str) -> str:
    text = str(raw or '').strip()
    text = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return text


def _build_default_poster_svg(title: str, quote: str) -> bytes:
    safe_title = _safe_svg_text(title)[:38]
    safe_quote = _safe_svg_text(quote)[:88]
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#0A2540"/>
    <stop offset="100%" stop-color="#1E4E7A"/>
  </linearGradient>
</defs>
<rect width="720" height="1280" fill="url(#g)"/>
<rect x="36" y="36" width="648" height="1208" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="2" rx="28"/>
<text x="64" y="150" fill="#FFFFFF" font-size="48" font-family="Arial, sans-serif" font-weight="700">FastEMIs Story</text>
<text x="64" y="222" fill="#B9D4EA" font-size="34" font-family="Arial, sans-serif" font-weight="600">{safe_title}</text>
<text x="64" y="310" fill="#EAF4FB" font-size="24" font-family="Arial, sans-serif">{safe_quote}</text>
<text x="64" y="1220" fill="#8EC5EA" font-size="22" font-family="Arial, sans-serif">Tap to Play</text>
</svg>"""
    return svg.encode('utf-8')


def _normalize_video_slug(seed: str) -> str:
    value = VIDEO_SLUG_PATTERN.sub('_', str(seed or '').strip().lower())
    value = re.sub(r'_+', '_', value).strip('_')
    if len(value) < 3:
        value = 'video_story'
    return value[:80]


def _next_available_video_slug(seed: str) -> str:
    base = _normalize_video_slug(seed)
    suffix = 0
    while True:
        candidate = base if suffix == 0 else f'{base}_{suffix}'
        candidate = candidate[:80]
        exists = TestimonialVideoAsset.objects.filter(slug__iexact=candidate).exists()
        if not exists:
            return candidate
        suffix += 1


def _parse_bool_like(value, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    text = str(value or '').strip().lower()
    if not text:
        return default
    return text in {'1', 'true', 'yes', 'y', 'on'}


def build_video_asset_payload(video: TestimonialVideoAsset) -> dict:
    uploaded_url = ''
    try:
        uploaded_url = video.uploaded_video.url if video.uploaded_video else ''
    except Exception:
        uploaded_url = ''

    preview_name = _desktop_variant_name(video.slug)
    preview_path = _video_root_dir() / preview_name
    preview_url = f'/media/video/{preview_name}' if preview_path.exists() else ''

    poster_name = _poster_variant_name(video.slug)
    poster_path = _video_root_dir() / poster_name
    poster_url = f'/media/video/{poster_name}' if poster_path.exists() else ''

    has_source = bool(uploaded_url) or bool(_find_source_video(video.source_file_name))
    return {
        'id': int(video.id),
        'slug': str(video.slug or '').strip(),
        'title': str(video.title or '').strip() or 'Untitled Video',
        'quote': str(video.quote or '').strip(),
        'source_file_name': str(video.source_file_name or '').strip(),
        'uploaded_video_url': uploaded_url,
        'duration_sec': int(video.duration_sec or 0),
        'priority': int(video.priority or 100),
        'is_active': bool(video.is_active),
        'show_in_hero': bool(video.show_in_hero),
        'preview_url': preview_url,
        'poster_url': poster_url,
        'has_source': bool(has_source),
        'created_at': video.created_at.isoformat() if video.created_at else None,
        'updated_at': video.updated_at.isoformat() if video.updated_at else None
    }


def ensure_default_video_inventory():
    default_ids = [str(item.get('id') or '').strip() for item in PUBLIC_VIDEO_CATALOG]
    existing = {
        str(video.slug or '').strip(): video
        for video in TestimonialVideoAsset.objects.filter(slug__in=default_ids)
    }

    to_create = []
    for item in PUBLIC_VIDEO_CATALOG:
        video_id = str(item.get('id') or '').strip()
        if not video_id or video_id in existing:
            continue
        to_create.append(TestimonialVideoAsset(
            slug=video_id,
            title=str(item.get('title') or '').strip() or 'Untitled Video',
            quote=str(item.get('quote') or '').strip(),
            source_file_name=str(item.get('source_file') or '').strip(),
            duration_sec=int(item.get('duration_sec') or 0),
            priority=int(item.get('priority') or 100),
            is_active=bool(item.get('active')),
            show_in_hero=video_id in HERO_VIDEO_IDS
        ))

    if to_create:
        TestimonialVideoAsset.objects.bulk_create(to_create)


def ensure_video_assets_ready(force: bool = False) -> dict:
    global VIDEO_CATALOG_VERIFIED, VIDEO_CATALOG_LAST_SCAN_TS, VIDEO_ASSET_LAST_STATUS, VIDEO_MANIFEST_CACHE

    ensure_default_video_inventory()

    now_ts = time.time()
    if (
        not force
        and VIDEO_CATALOG_VERIFIED
        and (now_ts - VIDEO_CATALOG_LAST_SCAN_TS) < VIDEO_ASSET_SCAN_MIN_INTERVAL_SEC
    ):
        return VIDEO_ASSET_LAST_STATUS

    video_dir = _video_root_dir()
    video_dir.mkdir(parents=True, exist_ok=True)

    rows = list(TestimonialVideoAsset.objects.all().only(
        'id',
        'slug',
        'title',
        'quote',
        'source_file_name',
        'uploaded_video'
    ))

    ready = 0
    missing_sources: list[str] = []
    for entry in rows:
        video_id = str(entry.slug or '').strip()
        if not video_id:
            continue

        source_path: Path | None = None
        if entry.uploaded_video:
            try:
                uploaded_path = Path(entry.uploaded_video.path).resolve()
                if uploaded_path.exists() and uploaded_path.is_file():
                    source_path = uploaded_path
            except Exception:
                source_path = None

        if source_path is None:
            source_path = _find_source_video(entry.source_file_name)

        if source_path is None:
            missing_sources.append(video_id)
            continue

        desktop_path = video_dir / _desktop_variant_name(video_id)
        if not desktop_path.exists():
            _link_or_copy_file(source_path, desktop_path)

        mobile_path = video_dir / _mobile_variant_name(video_id)
        if not mobile_path.exists() and desktop_path.exists():
            _link_or_copy_file(desktop_path, mobile_path)

        poster_path = video_dir / _poster_variant_name(video_id)
        if not poster_path.exists():
            poster_path.write_bytes(_build_default_poster_svg(
                title=str(entry.title or 'FastEMIs'),
                quote=str(entry.quote or 'Customer Story')
            ))
        if desktop_path.exists():
            ready += 1

    status_payload = {
        'ready': ready,
        'total': len(rows),
        'missing_sources': missing_sources
    }

    if not VIDEO_CATALOG_VERIFIED or force:
        if missing_sources:
            VIDEO_LOGGER.warning(
                'Video manifest integrity check: %s source video(s) missing: %s',
                len(missing_sources),
                ', '.join(sorted(set(missing_sources)))
            )
        VIDEO_LOGGER.info('Video manifest integrity check complete: %s/%s ready', ready, len(PUBLIC_VIDEO_CATALOG))
        VIDEO_CATALOG_VERIFIED = True

    VIDEO_CATALOG_LAST_SCAN_TS = now_ts
    VIDEO_ASSET_LAST_STATUS = status_payload
    VIDEO_MANIFEST_CACHE = {}
    return status_payload


def _surface_entries(surface: str) -> list[dict]:
    ensure_default_video_inventory()
    queryset = TestimonialVideoAsset.objects.filter(is_active=True)
    if surface == 'hero':
        queryset = queryset.filter(show_in_hero=True)

    rows = queryset.order_by('priority', 'id').values(
        'slug',
        'title',
        'quote',
        'duration_sec',
        'priority',
        'is_active'
    )

    return [
        {
            'id': str(row.get('slug') or '').strip(),
            'title': str(row.get('title') or '').strip(),
            'quote': str(row.get('quote') or '').strip(),
            'duration_sec': int(row.get('duration_sec') or 0),
            'priority': int(row.get('priority') or 100),
            'active': bool(row.get('is_active'))
        }
        for row in rows
        if str(row.get('slug') or '').strip()
    ]


def build_public_video_manifest(surface: str, device: str) -> dict:
    normalized_surface = surface if surface in {'hero', 'testimonials'} else 'hero'
    normalized_device = device if device in {'mobile', 'desktop'} else 'desktop'
    cache_key = (normalized_surface, normalized_device)
    cached = VIDEO_MANIFEST_CACHE.get(cache_key)
    now_ts = time.time()
    if cached and (now_ts - float(cached.get('_cached_at') or 0.0)) < VIDEO_MANIFEST_BUILD_CACHE_SEC:
        return dict(cached.get('payload') or {})

    ensure_video_assets_ready()
    video_dir = _video_root_dir()

    items = []
    for entry in _surface_entries(normalized_surface):
        video_id = str(entry['id'])
        preferred_name = _mobile_variant_name(video_id) if normalized_device == 'mobile' else _desktop_variant_name(video_id)
        fallback_name = _desktop_variant_name(video_id)

        preferred_path = video_dir / preferred_name
        fallback_path = video_dir / fallback_name
        selected_name = preferred_name if preferred_path.exists() else (fallback_name if fallback_path.exists() else '')
        if not selected_name:
            continue

        poster_name = _poster_variant_name(video_id)
        poster_path = video_dir / poster_name

        items.append({
            'id': video_id,
            'title': str(entry.get('title') or '').strip(),
            'quote': str(entry.get('quote') or '').strip(),
            'url': f'/media/video/{selected_name}',
            'posterUrl': f'/media/video/{poster_name}' if poster_path.exists() else '',
            'durationSec': int(entry.get('duration_sec') or 0),
            'priority': int(entry.get('priority') or 0),
            'active': bool(entry.get('active'))
        })

    payload = {
        'version': VIDEO_MANIFEST_VERSION,
        'cacheTtlSec': VIDEO_MANIFEST_CACHE_TTL_SEC,
        'items': items
    }
    VIDEO_MANIFEST_CACHE[cache_key] = {
        '_cached_at': now_ts,
        'payload': payload
    }
    return payload


def _safe_video_path(file_name: str) -> Path | None:
    root = _video_root_dir()
    requested = str(file_name or '').strip().lstrip('/')
    if not requested:
        return None
    candidate = (root / requested).resolve()
    try:
        candidate.relative_to(root)
    except Exception:
        return None
    if not candidate.exists() or not candidate.is_file():
        return None
    return candidate


def _set_media_cache_headers(response: HttpResponse) -> None:
    response['Accept-Ranges'] = 'bytes'
    response['Cache-Control'] = f'public, max-age={VIDEO_STREAM_CACHE_SECONDS}, immutable'
    response['X-Content-Type-Options'] = 'nosniff'


def build_range_stream_response(file_path: Path, request) -> HttpResponse:
    content_type = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
    file_size = int(file_path.stat().st_size)
    range_header = str(request.META.get('HTTP_RANGE') or '').strip()

    if not range_header:
        response = FileResponse(open(file_path, 'rb'), content_type=content_type)
        response['Content-Length'] = str(file_size)
        _set_media_cache_headers(response)
        return response

    match = VIDEO_RANGE_PATTERN.match(range_header)
    if not match:
        invalid = HttpResponse(status=416)
        invalid['Content-Range'] = f'bytes */{file_size}'
        _set_media_cache_headers(invalid)
        return invalid

    start_raw, end_raw = match.groups()
    try:
        if start_raw == '':
            suffix_length = int(end_raw or '0')
            if suffix_length <= 0:
                raise ValueError('invalid suffix')
            start = max(file_size - suffix_length, 0)
            end = file_size - 1
        else:
            start = int(start_raw)
            end = int(end_raw) if end_raw else file_size - 1
            if start >= file_size:
                raise ValueError('start out of range')
            if end < start:
                raise ValueError('end before start')
            end = min(end, file_size - 1)
    except Exception:
        invalid = HttpResponse(status=416)
        invalid['Content-Range'] = f'bytes */{file_size}'
        _set_media_cache_headers(invalid)
        return invalid

    length = end - start + 1
    with open(file_path, 'rb') as handle:
        handle.seek(start)
        data = handle.read(length)

    response = HttpResponse(data, status=206, content_type=content_type)
    response['Content-Length'] = str(length)
    response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
    _set_media_cache_headers(response)
    return response


def ensure_single_agent():
    agent = CustomUser.objects.filter(email=AGENT_EMAIL).first()

    if agent is None:
        agent = CustomUser.objects.create_user(
            email=AGENT_EMAIL,
            password=AGENT_PASSCODE,
            first_name=AGENT_USERNAME,
            is_active=True
        )
        agent.is_admin = True
        agent.save()
        return agent

    updated = False
    if agent.first_name != AGENT_USERNAME:
        agent.first_name = AGENT_USERNAME
        updated = True
    if not agent.is_admin:
        agent.is_admin = True
        updated = True
    if str(agent.password or '') != AGENT_PASSCODE:
        # Dev-only mode: keep passcode as raw text.
        agent.password = AGENT_PASSCODE
        updated = True

    if updated:
        agent.save()

    return agent


def build_user_payload(user: CustomUser, role_override: str | None = None, first_name_override: str | None = None):
    completion = calculate_profile_completion(user)
    return {
        'id': user.id,
        'email': user.email,
        'first_name': first_name_override if first_name_override is not None else user.first_name,
        'mobile_number': user.mobile_number,
        'role': role_override if role_override is not None else ('vendor' if user.is_admin else 'user'),
        'agreement_tab_enabled': bool(user.agreement_tab_enabled),
        'agreement_completed_at': user.agreement_completed_at.isoformat() if user.agreement_completed_at else None,
        'profile_complete': completion['profile_complete'],
        'profile_progress': completion['profile_progress'],
        'missing_fields': completion['missing_fields']
    }


def get_user_display_name(user: CustomUser) -> str:
    first = str(getattr(user, 'first_name', '') or '').strip()
    last = str(getattr(user, 'last_name', '') or '').strip()
    full_name = f'{first} {last}'.strip()
    if full_name:
        return full_name
    return str(getattr(user, 'email', '') or '').strip() or 'User'


def mask_restricted_content(raw_text: str):
    text = str(raw_text or '')
    reasons: list[str] = []
    masked = text

    def mask_email(match: re.Match):
        local = str(match.group(1) or '')
        domain = str(match.group(2) or '')
        if local:
            masked_local = local[0] + '*' * max(len(local) - 1, 2)
        else:
            masked_local = '***'
        return f'{masked_local}@{domain}'

    def mask_phone(match: re.Match):
        original = str(match.group(0) or '')
        digits = ''.join(ch for ch in original if ch.isdigit())
        if len(digits) < 10:
            return original
        last4 = digits[-4:]
        return f'***-***-{last4}'

    masked_after_email = RESTRICTED_EMAIL_PATTERN.sub(mask_email, masked)
    if masked_after_email != masked:
        reasons.append('Email address detected and masked')
    masked = masked_after_email

    masked_after_phone = RESTRICTED_PHONE_PATTERN.sub(mask_phone, masked)
    if masked_after_phone != masked:
        reasons.append('Phone number detected and masked')
    masked = masked_after_phone

    was_masked = masked != text
    moderation_note = '; '.join(reasons)
    return masked, was_masked, moderation_note


def log_moderation_event(
    *,
    user: CustomUser | None,
    context: str,
    action: str,
    reason: str,
    channel_ref: str = '',
    original_excerpt: str = '',
    sanitized_excerpt: str = ''
):
    try:
        ModerationEvent.objects.create(
            user=user,
            context=context,
            action=action,
            reason=reason[:255],
            channel_ref=str(channel_ref or '')[:120],
            original_excerpt=str(original_excerpt or '')[:2000],
            sanitized_excerpt=str(sanitized_excerpt or '')[:2000]
        )
    except Exception:
        pass


def _normalize_ghost_id(seed: str) -> str:
    value = re.sub(r'[^A-Za-z0-9_-]+', '_', str(seed or '').strip())
    value = re.sub(r'_+', '_', value).strip('_').lower()
    if len(value) < 3:
        value = f'ghost_{value}' if value else 'ghost_member'
    return value[:40]


def _next_available_ghost_id(seed: str, exclude_id: int | None = None) -> str:
    base = _normalize_ghost_id(seed)
    suffix = 0
    while True:
        candidate = base if suffix == 0 else f'{base}_{suffix}'
        candidate = candidate[:40]
        duplicate = CommunityPersona.objects.filter(ghost_id__iexact=candidate)
        if exclude_id:
            duplicate = duplicate.exclude(id=exclude_id)
        if not duplicate.exists():
            return candidate
        suffix += 1


def ensure_default_personas():
    # Backfill legacy rows that don't have ghost_id yet.
    for persona in CommunityPersona.objects.filter(Q(ghost_id__isnull=True) | Q(ghost_id='')).only('id', 'display_name'):
        persona.ghost_id = _next_available_ghost_id(persona.display_name, exclude_id=persona.id)
        persona.save(update_fields=['ghost_id'])

    for item in DEFAULT_COMMUNITY_PERSONAS:
        persona = CommunityPersona.objects.filter(ghost_id__iexact=item['ghost_id']).first()
        if persona is None:
            persona = CommunityPersona.objects.create(
                display_name=item['display_name'],
                ghost_id=item['ghost_id'],
                identity_tag=item['identity_tag'],
                info=item['info'],
                avatar_url=item['avatar_url'],
                short_bio=item['short_bio'],
                tone_guidelines=item['tone_guidelines'],
                is_active=True,
                sort_order=item['sort_order']
            )
            continue

        changed_fields: list[str] = []
        if str(persona.display_name or '').strip() != item['display_name']:
            persona.display_name = item['display_name']
            changed_fields.append('display_name')
        if str(persona.identity_tag or '').strip() != item['identity_tag']:
            persona.identity_tag = item['identity_tag']
            changed_fields.append('identity_tag')
        if str(persona.info or '').strip() != item['info']:
            persona.info = item['info']
            changed_fields.append('info')
        if str(persona.avatar_url or '').strip() != item['avatar_url']:
            persona.avatar_url = item['avatar_url']
            changed_fields.append('avatar_url')
        if str(persona.short_bio or '').strip() != item['short_bio']:
            persona.short_bio = item['short_bio']
            changed_fields.append('short_bio')
        if str(persona.tone_guidelines or '').strip() != item['tone_guidelines']:
            persona.tone_guidelines = item['tone_guidelines']
            changed_fields.append('tone_guidelines')
        if persona.sort_order != item['sort_order']:
            persona.sort_order = item['sort_order']
            changed_fields.append('sort_order')
        if not persona.is_active:
            persona.is_active = True
            changed_fields.append('is_active')
        if changed_fields:
            changed_fields.append('updated_at')
            persona.save(update_fields=changed_fields)


def get_or_create_community_settings():
    settings_obj = CommunitySettings.objects.order_by('-id').first()
    if settings_obj:
        return settings_obj
    return CommunitySettings.objects.create(
        community_title='community chat.',
        active_members_display=89
    )


def is_agreement_complete(user: CustomUser) -> bool:
    if not user or not user.agreement_completed_at:
        return False
    if not user.agreement_signature or not user.agreement_consent_video:
        return False

    active_questions = list(AgreementQuestion.objects.filter(is_active=True).values_list('id', flat=True)[:20])
    if not active_questions:
        return False

    answered_count = AgreementAnswer.objects.filter(
        user=user,
        question_id__in=active_questions
    ).count()
    return answered_count == len(active_questions)


def build_profile_response_payload(user: CustomUser):
    serializer = UserProfileSerializer(user)
    payload = serializer.data
    payload.update(calculate_profile_completion(user))
    payload['agreement_tab_enabled'] = bool(user.agreement_tab_enabled)
    payload['agreement_complete'] = is_agreement_complete(user)
    payload['agreement_completed_at'] = user.agreement_completed_at.isoformat() if user.agreement_completed_at else None
    return payload


def has_agent_access(request) -> bool:
    return bool(request.user and request.user.is_authenticated and request.user.is_admin)


def build_announcement_counts_payload():
    global_active = Announcement.objects.filter(
        is_active=True,
        type=Announcement.TYPE_GLOBAL
    ).count()
    private_qs = Announcement.objects.filter(
        is_active=True,
        type=Announcement.TYPE_PRIVATE,
        target_user__isnull=False
    )
    private_active_total = private_qs.count()
    private_active_by_user = {
        str(row['target_user_id']): int(row['count'])
        for row in private_qs.values('target_user_id').annotate(count=Count('id'))
    }

    return {
        'global_active': int(global_active),
        'private_active_total': int(private_active_total),
        'private_active_by_user': private_active_by_user
    }


def is_user_active_now(user: CustomUser) -> bool:
    if not user.last_seen_at:
        return False
    return user.last_seen_at >= timezone.now() - timedelta(seconds=90)


def resolve_chat_target_user(request, user_id: str | None = None):
    if has_agent_access(request):
        target_id = str(user_id or '').strip()
        if not target_id:
            return None
        return CustomUser.objects.filter(id=target_id, is_admin=False).first()
    return request.user


def parse_since_timestamp(raw_value: str | None):
    if not raw_value:
        return None
    parsed = parse_datetime(raw_value)
    if parsed is None:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def delete_global_payment_records(queryset) -> int:
    records = list(queryset.only('id', 'qr_image'))
    if not records:
        return 0

    for record in records:
        try:
            if record.qr_image:
                record.qr_image.delete(save=False)
        except Exception:
            pass

    ids = [record.id for record in records]
    GlobalPaymentConfig.objects.filter(id__in=ids).delete()
    return len(ids)


def purge_expired_global_payment_configs() -> int:
    now = timezone.now()
    expired_qs = GlobalPaymentConfig.objects.filter(
        Q(expires_at__lte=now) | Q(is_active=False)
    )
    return delete_global_payment_records(expired_qs)


def has_bank_details(entity) -> bool:
    return bool(
        str(getattr(entity, 'account_holder_name', '') or '').strip() and
        str(getattr(entity, 'bank_name', '') or '').strip() and
        str(getattr(entity, 'account_number', '') or '').strip() and
        str(getattr(entity, 'ifsc', '') or '').strip()
    )


def clone_uploaded_file(source_field, prefix: str):
    if not source_field:
        return None
    try:
        source_field.open('rb')
        content = source_field.read()
        filename = os.path.basename(str(source_field.name or 'file.bin'))
        return ContentFile(content, name=f'{prefix}-{int(timezone.now().timestamp())}-{filename}')
    except Exception:
        return None
    finally:
        try:
            source_field.close()
        except Exception:
            pass


def purge_old_payment_templates() -> int:
    cutoff = timezone.now() - timedelta(hours=24)
    stale_qs = PaymentConfigTemplate.objects.filter(created_at__lt=cutoff)
    records = list(stale_qs.only('id', 'qr_image'))
    if not records:
        return 0

    for record in records:
        try:
            if record.qr_image:
                record.qr_image.delete(save=False)
        except Exception:
            pass

    ids = [record.id for record in records]
    PaymentConfigTemplate.objects.filter(id__in=ids).delete()
    return len(ids)


def delete_chat_messages_for_user(user: CustomUser) -> int:
    messages = list(ChatMessage.objects.filter(user=user).only('id', 'media_file'))
    if not messages:
        return 0

    for message in messages:
        try:
            if message.media_file:
                message.media_file.delete(save=False)
        except Exception:
            pass

    ids = [message.id for message in messages]
    ChatMessage.objects.filter(id__in=ids).delete()
    return len(ids)


def delete_ghost_messages_for_thread(thread: GhostChatThread) -> int:
    messages = list(GhostChatMessage.objects.filter(thread=thread).only('id', 'media_file'))
    if not messages:
        return 0

    for message in messages:
        try:
            if message.media_file:
                message.media_file.delete(save=False)
        except Exception:
            pass

    ids = [message.id for message in messages]
    GhostChatMessage.objects.filter(id__in=ids).delete()
    return len(ids)


def delete_community_posts_for_persona(persona: CommunityPersona) -> int:
    posts = list(CommunityPost.objects.filter(persona=persona).only('id', 'media_file'))
    if not posts:
        return 0

    for post in posts:
        try:
            if post.media_file:
                post.media_file.delete(save=False)
        except Exception:
            pass

    ids = [post.id for post in posts]
    CommunityPost.objects.filter(id__in=ids).delete()
    return len(ids)


def create_payment_template_from_payload(validated_data: dict, created_by: CustomUser):
    template = PaymentConfigTemplate(
        account_holder_name=str(validated_data.get('account_holder_name') or '').strip(),
        bank_name=str(validated_data.get('bank_name') or '').strip(),
        account_number=str(validated_data.get('account_number') or '').strip(),
        ifsc=str(validated_data.get('ifsc') or '').strip().upper(),
        branch=str(validated_data.get('branch') or '').strip(),
        created_by=created_by
    )

    uploaded_qr = validated_data.get('qr_image')
    if uploaded_qr:
        template.qr_image = uploaded_qr

    template.save()
    return template


def build_user_agreement_questions(user: CustomUser):
    questions = list(AgreementQuestion.objects.filter(is_active=True).order_by('question_id')[:20])
    question_ids = [question.id for question in questions]

    answers = AgreementAnswer.objects.filter(
        user=user,
        question_id__in=question_ids
    ).select_related('question')

    answer_by_question_id: dict[int, AgreementAnswer] = {}
    for answer in answers:
        answer_by_question_id[answer.question_id] = answer

    payload = []
    for question in questions:
        answer = answer_by_question_id.get(question.id)
        payload.append({
            'questionId': question.question_id,
            'description': question.description,
            'answerType': 'yes_no',
            'answer': 'yes' if answer and answer.answer else ('no' if answer else None),
            'readonly': bool(answer)
        })

    all_answered = len(payload) > 0 and all(item['readonly'] for item in payload)
    signature_url = ''
    consent_video_url = ''
    try:
        signature_url = user.agreement_signature.url if user.agreement_signature else ''
    except Exception:
        signature_url = ''
    try:
        consent_video_url = user.agreement_consent_video.url if user.agreement_consent_video else ''
    except Exception:
        consent_video_url = ''

    complete = bool(
        all_answered
        and signature_url
        and consent_video_url
        and user.agreement_completed_at
    )
    return {
        'questions': payload,
        'all_answered': all_answered,
        'total_questions': len(payload),
        'signature_url': signature_url,
        'consent_video_url': consent_video_url,
        'agreement_enabled': bool(user.agreement_tab_enabled),
        'agreement_complete': complete,
        'agreement_completed_at': user.agreement_completed_at.isoformat() if user.agreement_completed_at else None
    }


def resolve_ghost_thread(request, thread_id: int | str):
    thread = GhostChatThread.objects.select_related('user', 'persona').filter(id=thread_id).first()
    if thread is None:
        return None
    if has_agent_access(request):
        return thread
    if str(thread.user_id) != str(request.user.id):
        return None
    return thread


class PublicVideoManifestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        surface = str(request.query_params.get('surface') or 'hero').strip().lower()
        device = str(request.query_params.get('device') or 'desktop').strip().lower()

        payload = build_public_video_manifest(surface=surface, device=device)
        response = Response(payload, status=status.HTTP_200_OK)
        response['Cache-Control'] = f'public, max-age={VIDEO_MANIFEST_CACHE_TTL_SEC}'
        return response


class PublicVideoStreamView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, file_name: str):
        safe_path = _safe_video_path(file_name)
        if safe_path is None:
            # Lazy one-shot materialization for first access; skip expensive checks for normal range requests.
            ensure_video_assets_ready()
            safe_path = _safe_video_path(file_name)
        if safe_path is None:
            return HttpResponse(status=404)

        return build_range_stream_response(safe_path, request)


class AgentVideoCollectionView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        ensure_default_video_inventory()
        queryset = TestimonialVideoAsset.objects.all().order_by('priority', 'id')
        videos = [build_video_asset_payload(video) for video in queryset]
        return Response({
            'videos': videos,
            'count': len(videos),
            'active_count': sum(1 for row in videos if bool(row.get('is_active'))),
            'hero_count': sum(1 for row in videos if bool(row.get('show_in_hero')))
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        title = str(request.data.get('title') or '').strip()
        if not title:
            return Response({'title': ['Title is required.']}, status=status.HTTP_400_BAD_REQUEST)

        video_file = request.FILES.get('video_file')
        if not video_file:
            return Response({'video_file': ['Video file is required.']}, status=status.HTTP_400_BAD_REQUEST)

        content_type = str(getattr(video_file, 'content_type', '') or '').lower()
        if not content_type.startswith('video/'):
            return Response({'video_file': ['Only video files are allowed.']}, status=status.HTTP_400_BAD_REQUEST)

        quote = str(request.data.get('quote') or '').strip()
        requested_slug = str(request.data.get('slug') or '').strip()
        slug_seed = requested_slug or title
        slug = _next_available_video_slug(slug_seed)

        try:
            priority = int(request.data.get('priority') or 100)
        except (TypeError, ValueError):
            return Response({'priority': ['Priority must be a number.']}, status=status.HTTP_400_BAD_REQUEST)
        priority = max(1, min(10000, priority))

        show_in_hero = _parse_bool_like(request.data.get('show_in_hero'), default=False)
        duration_raw = request.data.get('duration_sec')
        duration_sec = 0
        if duration_raw not in [None, '']:
            try:
                duration_sec = max(0, min(1200, int(duration_raw)))
            except (TypeError, ValueError):
                return Response({'duration_sec': ['Duration must be a number.']}, status=status.HTTP_400_BAD_REQUEST)

        created = TestimonialVideoAsset.objects.create(
            slug=slug,
            title=title,
            quote=quote,
            uploaded_video=video_file,
            source_file_name='',
            duration_sec=duration_sec,
            priority=priority,
            show_in_hero=show_in_hero,
            is_active=True,
            created_by=request.user
        )

        # Force one refresh cycle so new uploads materialize into cached variants quickly.
        ensure_video_assets_ready(force=True)
        return Response({'video': build_video_asset_payload(created)}, status=status.HTTP_201_CREATED)


class AgentVideoDetailView(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, video_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        video = TestimonialVideoAsset.objects.filter(id=video_id).first()
        if not video:
            return Response({'error': 'Video not found.'}, status=status.HTTP_404_NOT_FOUND)

        updated_fields: list[str] = []

        if 'is_active' in request.data:
            video.is_active = _parse_bool_like(request.data.get('is_active'), default=video.is_active)
            updated_fields.append('is_active')

        if 'show_in_hero' in request.data:
            video.show_in_hero = _parse_bool_like(request.data.get('show_in_hero'), default=video.show_in_hero)
            updated_fields.append('show_in_hero')

        if 'title' in request.data:
            title = str(request.data.get('title') or '').strip()
            if not title:
                return Response({'title': ['Title cannot be empty.']}, status=status.HTTP_400_BAD_REQUEST)
            video.title = title
            updated_fields.append('title')

        if 'quote' in request.data:
            video.quote = str(request.data.get('quote') or '').strip()
            updated_fields.append('quote')

        if 'priority' in request.data:
            try:
                priority = int(request.data.get('priority'))
            except (TypeError, ValueError):
                return Response({'priority': ['Priority must be a number.']}, status=status.HTTP_400_BAD_REQUEST)
            video.priority = max(1, min(10000, priority))
            updated_fields.append('priority')

        if 'duration_sec' in request.data:
            try:
                duration = int(request.data.get('duration_sec'))
            except (TypeError, ValueError):
                return Response({'duration_sec': ['Duration must be a number.']}, status=status.HTTP_400_BAD_REQUEST)
            video.duration_sec = max(0, min(1200, duration))
            updated_fields.append('duration_sec')

        replacement = request.FILES.get('video_file')
        if replacement:
            content_type = str(getattr(replacement, 'content_type', '') or '').lower()
            if not content_type.startswith('video/'):
                return Response({'video_file': ['Only video files are allowed.']}, status=status.HTTP_400_BAD_REQUEST)
            video.uploaded_video = replacement
            updated_fields.append('uploaded_video')
            if video.source_file_name:
                video.source_file_name = ''
                updated_fields.append('source_file_name')

        if not updated_fields:
            return Response({'video': build_video_asset_payload(video)}, status=status.HTTP_200_OK)

        updated_fields.append('updated_at')
        video.save(update_fields=updated_fields)
        ensure_video_assets_ready(force=True)
        return Response({'video': build_video_asset_payload(video)}, status=status.HTTP_200_OK)
 
class UserRegister(APIView):  
    
    def post(self,request):
        
        serializer= UserRegisterSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data,status=status.HTTP_201_CREATED)
        else:
            return Response(serializer._errors,status=status.HTTP_400_BAD_REQUEST)
        
        

class UserLoginView(APIView):
    
    def post(self,request):
        
        serializer = LoginSerializer(data=request.data)
        
        if serializer.is_valid():
            email = serializer.validated_data['email']
            password = serializer.validated_data['password']
            
            user = CustomUser.objects.filter(email__iexact=email).first()
            
            if user is not None and user.is_active and str(user.password or '') == str(password):
                now = timezone.now()
                user.last_login = now
                user.last_seen_at = now
                user.save(update_fields=['last_login', 'last_seen_at'])
                
                refresh = RefreshToken.for_user(user)
                return Response({
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'user': build_user_payload(user)
                }, status=status.HTTP_200_OK)
            else:
                return Response({
                    "error": "Invalid Email or Password"
                }, status=status.HTTP_401_UNAUTHORIZED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserSignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserSignupSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()
        now = timezone.now()
        user.last_login = now
        user.last_seen_at = now
        user.save(update_fields=['last_login', 'last_seen_at'])
        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': build_user_payload(user, role_override='user')
        }, status=status.HTTP_201_CREATED)


class AgentAccessView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = AgentAccessSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        passcode = serializer.validated_data["passcode"].strip()
        if not passcode:
            return Response({"error": "Passcode is required"}, status=status.HTTP_400_BAD_REQUEST)

        agent = ensure_single_agent()
        if not agent.is_admin or not agent.is_active or str(agent.password or '') != passcode:
            return Response({"error": "Invalid passcode"}, status=status.HTTP_401_UNAUTHORIZED)

        now = timezone.now()
        refresh = RefreshToken.for_user(agent)
        access_token = refresh.access_token
        agent.last_login = now
        agent.last_seen_at = now
        agent.active_agent_access_jti = str(access_token.get('jti') or '').strip()
        agent.active_agent_refresh_jti = str(refresh.get('jti') or '').strip()
        agent.save(update_fields=['last_login', 'last_seen_at', 'active_agent_access_jti', 'active_agent_refresh_jti'])
        return Response({
            "refresh": str(refresh),
            "access": str(access_token),
            "user": build_user_payload(agent, role_override='vendor', first_name_override=AGENT_USERNAME)
        }, status=status.HTTP_200_OK)
                
            

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            if getattr(request.user, 'is_admin', False):
                request.user.active_agent_access_jti = None
                request.user.active_agent_refresh_jti = None
                request.user.save(update_fields=['active_agent_access_jti', 'active_agent_refresh_jti'])
            return Response({"message": "Successfully logged out"}, status=status.HTTP_205_RESET_CONTENT)
        except Exception as e:
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)        


class AgentTokenRefreshView(TokenRefreshView):
    serializer_class = AgentSingleSessionTokenRefreshSerializer
                

class UserProfileView(APIView):
    
    permission_classes=[IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self,request):
        user = request.user
        if user is not None:
           return Response(build_profile_response_payload(user),status=status.HTTP_200_OK)
       
        return Response({'error': 'User not found'}, status=status.HTTP_400_BAD_REQUEST)

    def patch(self, request):
        user = request.user
        serializer = UserProfileUpdateSerializer(user, data=request.data, partial=True)

        if serializer.is_valid():
            user = serializer.save()
            return Response(build_profile_response_payload(user), status=status.HTTP_200_OK)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserLocationCaptureView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if has_agent_access(request):
            return Response({'error': 'Location capture is supported for user accounts only.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserLocationCaptureSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        latitude = serializer.validated_data['latitude']
        longitude = serializer.validated_data['longitude']
        accuracy_m = serializer.validated_data.get('accuracy_m')
        now = timezone.now()

        request.user.last_location_latitude = latitude
        request.user.last_location_longitude = longitude
        request.user.last_location_accuracy_m = accuracy_m
        request.user.last_location_captured_at = now
        request.user.last_seen_at = now
        request.user.save(update_fields=[
            'last_location_latitude',
            'last_location_longitude',
            'last_location_accuracy_m',
            'last_location_captured_at',
            'last_seen_at'
        ])

        return Response({
            'message': 'Location captured successfully.',
            'location': build_location_payload(request.user)
        }, status=status.HTTP_200_OK)


class AgentUsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        required_fields = set(PROFILE_REQUIRED_FIELDS + [
            'first_name',
            'last_name',
            'email',
            'mobile_number',
            'requested_amount',
            'marital_status',
            'spouse_occupation',
            'is_active',
            'is_chat_favorite',
            'last_login',
            'last_location_latitude',
            'last_location_longitude',
            'last_location_accuracy_m',
            'last_location_captured_at',
            'agreement_tab_enabled',
            'agreement_completed_at',
            'agreement_signature',
            'agreement_consent_video'
        ])

        users = CustomUser.objects.filter(is_admin=False).only(*required_fields).order_by('-id')
        payload = [build_agent_user_summary_payload(user) for user in users]
        return Response({'users': payload}, status=status.HTTP_200_OK)


class AgentUserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_target_user(self, user_id: str):
        return CustomUser.objects.filter(id=user_id, is_admin=False).first()

    def get(self, request, user_id: str):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        user = self._get_target_user(user_id)
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'user': build_agent_user_detail_payload(user)}, status=status.HTTP_200_OK)

    def patch(self, request, user_id: str):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        user = self._get_target_user(user_id)
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AgentUserManageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        user.is_active = action != 'disable'
        user.save(update_fields=['is_active'])

        return Response({
            'message': 'User updated successfully',
            'user': build_agent_user_detail_payload(user)
        }, status=status.HTTP_200_OK)

    def delete(self, request, user_id: str):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        user = self._get_target_user(user_id)
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        user.delete()
        return Response({'message': 'User deleted successfully'}, status=status.HTTP_200_OK)


class ChatThreadsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        if has_agent_access(request):
            target_user_id = str(request.query_params.get('user_id') or '').strip()
            search = str(request.query_params.get('search') or '').strip()
            favorites_only = str(request.query_params.get('favorites_only') or '').strip().lower() in ['1', 'true', 'yes']
            users = CustomUser.objects.filter(is_admin=False)
            if target_user_id:
                users = users.filter(id=target_user_id)
            if search:
                users = users.filter(
                    Q(first_name__icontains=search) |
                    Q(last_name__icontains=search) |
                    Q(email__icontains=search) |
                    Q(mobile_number__icontains=search)
                )
            if favorites_only:
                users = users.filter(is_chat_favorite=True)

            latest_visible_messages = ChatMessage.objects.filter(
                user=OuterRef('pk'),
                deleted_for_everyone=False
            ).order_by('-created_at')

            users = users.annotate(
                full_name=Coalesce(
                    Concat(
                        Coalesce(F('first_name'), Value('')),
                        Value(' '),
                        Coalesce(F('last_name'), Value(''))
                    ),
                    Value('')
                ),
                chat_last_message_id=Subquery(latest_visible_messages.values('id')[:1]),
                chat_last_message_type=Subquery(latest_visible_messages.values('message_type')[:1]),
                chat_last_message_content=Subquery(latest_visible_messages.values('content')[:1]),
                chat_last_message_media_name=Subquery(latest_visible_messages.values('media_name')[:1]),
                chat_last_message_at=Subquery(latest_visible_messages.values('created_at')[:1]),
                unread_for_agent=Count(
                    'chat_messages',
                    filter=Q(
                        chat_messages__sender_role=ChatMessage.SENDER_USER,
                        chat_messages__read_by_agent=False,
                        chat_messages__deleted_for_everyone=False
                    )
                )
            ).only(
                'id',
                'first_name',
                'last_name',
                'email',
                'mobile_number',
                'last_login',
                'last_seen_at',
                'assigned_agent_name',
                'is_chat_favorite'
            ).order_by('-is_chat_favorite', '-chat_last_message_at', '-last_login', '-id')

            payload = []
            for user in users:
                full_name = str(getattr(user, 'full_name', '') or '').strip() or 'Not filled yet'
                last_message_type = str(getattr(user, 'chat_last_message_type', '') or '')
                last_message_content = str(getattr(user, 'chat_last_message_content', '') or '').strip()
                last_message_media_name = str(getattr(user, 'chat_last_message_media_name', '') or '').strip()
                if last_message_type == ChatMessage.TYPE_MEDIA:
                    preview = f'Media: {last_message_media_name or "Attachment"}'
                else:
                    preview = last_message_content or 'No messages yet'

                payload.append({
                    'user_id': str(user.id),
                    'full_name': full_name,
                    'email': str(user.email or '').strip(),
                    'mobile_number': str(user.mobile_number or '').strip(),
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'last_seen_at': user.last_seen_at.isoformat() if user.last_seen_at else None,
                    'is_active_now': is_user_active_now(user),
                    'assigned_agent_name': str(user.assigned_agent_name or '').strip() or AGENT_USERNAME,
                    'is_favorite': bool(user.is_chat_favorite),
                    'unread_for_agent': int(getattr(user, 'unread_for_agent', 0) or 0),
                    'last_message': {
                        'id': getattr(user, 'chat_last_message_id', None),
                        'type': last_message_type or None,
                        'preview': preview,
                        'created_at': user.chat_last_message_at.isoformat() if getattr(user, 'chat_last_message_at', None) else None
                    }
                })
            return Response({'threads': payload}, status=status.HTTP_200_OK)

        user = request.user
        latest_message = ChatMessage.objects.filter(user=user, deleted_for_everyone=False).order_by('-created_at').first()
        unread_for_user = ChatMessage.objects.filter(
            user=user,
            deleted_for_everyone=False,
            read_by_user=False
        ).exclude(sender_role=ChatMessage.SENDER_USER).count()

        if latest_message is not None and latest_message.message_type == ChatMessage.TYPE_MEDIA:
            preview = f'Media: {latest_message.media_name or "Attachment"}'
        else:
            preview = latest_message.content if latest_message else 'No messages yet'

        payload = {
            'user_id': str(user.id),
            'assigned_agent_name': str(user.assigned_agent_name or '').strip() or AGENT_USERNAME,
            'unread_for_user': unread_for_user,
            'last_message': {
                'id': latest_message.id if latest_message else None,
                'type': latest_message.message_type if latest_message else None,
                'preview': preview,
                'created_at': latest_message.created_at.isoformat() if latest_message else None
            }
        }
        return Response({'thread': payload}, status=status.HTTP_200_OK)


class ChatMessagesView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        target_user = resolve_chat_target_user(request, request.query_params.get('user_id'))
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        since_id_raw = str(request.query_params.get('since_id') or '').strip()
        since_id = int(since_id_raw) if since_id_raw.isdigit() else None
        since = parse_since_timestamp(str(request.query_params.get('since') or '').strip() or None)

        limit_raw = str(request.query_params.get('limit') or '').strip()
        limit = int(limit_raw) if limit_raw.isdigit() else 120
        limit = max(20, min(limit, 300))

        base_qs = ChatMessage.objects.filter(user=target_user, deleted_for_everyone=False).order_by('id')

        if since_id is not None and since_id > 0:
            messages_qs = base_qs.filter(id__gt=since_id)
        elif since is not None:
            messages_qs = base_qs.filter(created_at__gt=since)
        else:
            recent_ids = list(base_qs.order_by('-id').values_list('id', flat=True)[:limit])
            messages_qs = base_qs.filter(id__in=recent_ids)

        messages = list(messages_qs.order_by('id'))
        actor_role = 'agent' if has_agent_access(request) else 'user'

        serializer = ChatMessageSerializer(messages, many=True, context={'actor_role': actor_role})

        if actor_role == 'agent':
            ChatMessage.objects.filter(
                user=target_user,
                sender_role=ChatMessage.SENDER_USER,
                read_by_agent=False,
                deleted_for_everyone=False
            ).update(read_by_agent=True)
        else:
            ChatMessage.objects.filter(
                user=target_user,
                read_by_user=False,
                deleted_for_everyone=False
            ).exclude(sender_role=ChatMessage.SENDER_USER).update(read_by_user=True)

        return Response({
            'user_id': str(target_user.id),
            'messages': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        serializer = ChatMessageCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        target_user = resolve_chat_target_user(request, serializer.validated_data.get('user_id'))
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        media_file = serializer.validated_data.get('media_file')
        content = serializer.validated_data.get('content', '')
        is_agent = has_agent_access(request)

        sender_label = ''
        if is_agent:
            sender_label = str(target_user.assigned_agent_name or '').strip() or AGENT_USERNAME

        message = ChatMessage.objects.create(
            user=target_user,
            sender_role=ChatMessage.SENDER_AGENT if is_agent else ChatMessage.SENDER_USER,
            sender_label=sender_label,
            message_type=ChatMessage.TYPE_MEDIA if media_file else ChatMessage.TYPE_TEXT,
            content=content,
            media_file=media_file if media_file else None,
            media_name=getattr(media_file, 'name', '') if media_file else '',
            read_by_user=not is_agent,
            read_by_agent=is_agent
        )

        response_serializer = ChatMessageSerializer(
            message,
            context={'actor_role': 'agent' if is_agent else 'user'}
        )
        return Response({'message': response_serializer.data}, status=status.HTTP_201_CREATED)


class ChatMediaView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        target_user = resolve_chat_target_user(request, request.query_params.get('user_id'))
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        media_messages = ChatMessage.objects.filter(
            user=target_user,
            deleted_for_everyone=False,
            message_type=ChatMessage.TYPE_MEDIA
        ).order_by('-id')[:240]

        actor_role = 'agent' if has_agent_access(request) else 'user'
        serializer = ChatMessageSerializer(media_messages, many=True, context={'actor_role': actor_role})
        return Response({'media': serializer.data}, status=status.HTTP_200_OK)


class ChatDeleteMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can delete messages for everyone.'}, status=status.HTTP_403_FORBIDDEN)

        message = ChatMessage.objects.filter(id=message_id, deleted_for_everyone=False).first()
        if message is None:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)

        message.deleted_for_everyone = True
        message.deleted_by_agent = True
        message.deleted_at = timezone.now()
        message.save(update_fields=['deleted_for_everyone', 'deleted_by_agent', 'deleted_at'])
        return Response({'message': 'Deleted for everyone'}, status=status.HTTP_200_OK)


class ChatThreadManageView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, user_id: str):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can manage chat threads.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChatThreadFavoriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        target_user = CustomUser.objects.filter(id=user_id, is_admin=False).first()
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        target_user.is_chat_favorite = bool(serializer.validated_data['favorite'])
        target_user.save(update_fields=['is_chat_favorite'])
        return Response({
            'user_id': str(target_user.id),
            'is_favorite': bool(target_user.is_chat_favorite)
        }, status=status.HTTP_200_OK)

    def delete(self, request, user_id: str):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can delete entire chats.'}, status=status.HTTP_403_FORBIDDEN)

        target_user = CustomUser.objects.filter(id=user_id, is_admin=False).first()
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        deleted_count = delete_chat_messages_for_user(target_user)
        return Response({
            'message': 'Chat deleted successfully.',
            'user_id': str(target_user.id),
            'deleted_messages': deleted_count
        }, status=status.HTTP_200_OK)


class ChatAliasView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can set alias'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ChatAliasSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_id = serializer.validated_data['user_id']
        alias = serializer.validated_data['alias']

        target_user = CustomUser.objects.filter(id=user_id, is_admin=False).first()
        if target_user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        target_user.assigned_agent_name = alias
        target_user.save(update_fields=['assigned_agent_name'])
        return Response({
            'user_id': str(target_user.id),
            'assigned_agent_name': target_user.assigned_agent_name
        }, status=status.HTTP_200_OK)


class ChatPresenceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        request.user.last_seen_at = now
        request.user.save(update_fields=['last_seen_at'])
        return Response({
            'last_seen_at': now.isoformat(),
            'is_active_now': True
        }, status=status.HTTP_200_OK)


class CommunityPersonaCollectionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = CommunityPersona.objects.all()
        if not has_agent_access(request):
            queryset = queryset.filter(is_active=True)

        search = str(request.query_params.get('q') or '').strip()
        if search:
            queryset = queryset.filter(
                Q(display_name__icontains=search) |
                Q(identity_tag__icontains=search) |
                Q(ghost_id__icontains=search)
            )

        personas = queryset.order_by('sort_order', 'display_name')[:300]
        actor_role = 'agent' if has_agent_access(request) else 'user'
        serializer = CommunityPersonaSerializer(personas, many=True, context={'actor_role': actor_role})
        return Response({
            'ghost_members': serializer.data,
            'personas': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can create ghost members.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = CommunityPersonaUpsertSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        display_name = serializer.validated_data['display_name']
        ghost_id = str(serializer.validated_data.get('ghost_id') or '').strip()
        identity_tag = str(serializer.validated_data.get('identity_tag') or '').strip()
        info = str(serializer.validated_data.get('info') or '').strip()
        if not ghost_id:
            return Response({'ghost_id': 'Ghost ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if not identity_tag:
            return Response({'identity_tag': 'Identity tag is required.'}, status=status.HTTP_400_BAD_REQUEST)

        duplicate = CommunityPersona.objects.filter(ghost_id__iexact=ghost_id).exists()
        if duplicate:
            return Response({'ghost_id': 'Ghost ID already exists.'}, status=status.HTTP_400_BAD_REQUEST)
        duplicate_name = CommunityPersona.objects.filter(display_name__iexact=display_name).exists()
        if duplicate_name:
            return Response({'display_name': 'Display name already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            persona = CommunityPersona.objects.create(
                display_name=display_name,
                ghost_id=ghost_id,
                identity_tag=identity_tag,
                info=info,
                avatar_url=serializer.validated_data.get('avatar_url', ''),
                short_bio=serializer.validated_data.get('short_bio', ''),
                tone_guidelines=serializer.validated_data.get('tone_guidelines', ''),
                is_active=bool(serializer.validated_data.get('is_active', True)),
                sort_order=int(serializer.validated_data.get('sort_order', 100))
            )
        except IntegrityError:
            return Response(
                {'ghost_id': 'Ghost ID already exists. Use another value.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'message': 'Ghost member created successfully.',
            'ghost_member': CommunityPersonaSerializer(persona, context={'actor_role': 'agent'}).data,
            'persona': CommunityPersonaSerializer(persona, context={'actor_role': 'agent'}).data
        }, status=status.HTTP_201_CREATED)


class CommunityPersonaDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, persona_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can update ghost members.'}, status=status.HTTP_403_FORBIDDEN)

        persona = CommunityPersona.objects.filter(id=persona_id).first()
        if persona is None:
            return Response({'error': 'Persona not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = CommunityPersonaUpsertSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = {}
        if 'ghost_id' in serializer.validated_data:
            return Response({'ghost_id': 'ghost_id is locked and cannot be edited.'}, status=status.HTTP_400_BAD_REQUEST)
        if 'display_name' in serializer.validated_data:
            display_name = serializer.validated_data['display_name']
            duplicate = CommunityPersona.objects.filter(display_name__iexact=display_name).exclude(id=persona.id).exists()
            if duplicate:
                return Response({'display_name': 'Display name already exists.'}, status=status.HTTP_400_BAD_REQUEST)
            updates['display_name'] = display_name
        if 'identity_tag' in serializer.validated_data:
            identity_tag = str(serializer.validated_data.get('identity_tag') or '').strip()
            if not identity_tag:
                return Response({'identity_tag': 'Identity tag is required.'}, status=status.HTTP_400_BAD_REQUEST)
            updates['identity_tag'] = identity_tag
        if 'info' in serializer.validated_data:
            updates['info'] = str(serializer.validated_data.get('info') or '').strip()[:220]
        if 'avatar_url' in serializer.validated_data:
            updates['avatar_url'] = serializer.validated_data['avatar_url']
        if 'short_bio' in serializer.validated_data:
            updates['short_bio'] = serializer.validated_data['short_bio']
        if 'tone_guidelines' in serializer.validated_data:
            updates['tone_guidelines'] = serializer.validated_data['tone_guidelines']
        if 'is_active' in serializer.validated_data:
            updates['is_active'] = bool(serializer.validated_data['is_active'])
        if 'sort_order' in serializer.validated_data:
            updates['sort_order'] = int(serializer.validated_data['sort_order'])

        if updates:
            for key, value in updates.items():
                setattr(persona, key, value)
            updates['updated_at'] = timezone.now()
            persona.save(update_fields=list(updates.keys()))

        return Response({
            'message': 'Ghost member updated successfully.',
            'ghost_member': CommunityPersonaSerializer(persona, context={'actor_role': 'agent'}).data,
            'persona': CommunityPersonaSerializer(persona, context={'actor_role': 'agent'}).data
        }, status=status.HTTP_200_OK)

    def delete(self, request, persona_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can delete ghost members.'}, status=status.HTTP_403_FORBIDDEN)

        persona = CommunityPersona.objects.filter(id=persona_id).first()
        if persona is None:
            return Response({'error': 'Ghost member not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            threads = list(GhostChatThread.objects.filter(persona=persona).only('id'))
            deleted_messages = 0
            for thread in threads:
                deleted_messages += delete_ghost_messages_for_thread(thread)
            deleted_threads = GhostChatThread.objects.filter(persona=persona).count()
            GhostChatThread.objects.filter(persona=persona).delete()
            deleted_posts = delete_community_posts_for_persona(persona)
            persona.delete()

        return Response({
            'message': 'Ghost member deleted successfully.',
            'deleted_threads': deleted_threads,
            'deleted_messages': deleted_messages,
            'deleted_posts': deleted_posts
        }, status=status.HTTP_200_OK)


class CommunitySettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, _request):
        settings_obj = get_or_create_community_settings()
        return Response({
            'settings': CommunitySettingsSerializer(settings_obj).data
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can update community settings.'}, status=status.HTTP_403_FORBIDDEN)

        settings_obj = get_or_create_community_settings()
        serializer = CommunitySettingsSerializer(settings_obj, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = dict(serializer.validated_data)
        if 'community_title' in updates:
            settings_obj.community_title = updates['community_title']
        if 'active_members_display' in updates:
            settings_obj.active_members_display = updates['active_members_display']
        settings_obj.updated_by = request.user
        settings_obj.save(update_fields=['community_title', 'active_members_display', 'updated_by', 'updated_at'])

        return Response({
            'message': 'Community settings updated successfully.',
            'settings': CommunitySettingsSerializer(settings_obj).data
        }, status=status.HTTP_200_OK)


class CommunityFeedView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        settings_obj = get_or_create_community_settings()

        limit_raw = str(request.query_params.get('limit') or '').strip()
        limit = int(limit_raw) if limit_raw.isdigit() else 20
        limit = max(5, min(limit, 60))

        reply_limit_raw = str(request.query_params.get('reply_limit') or '').strip()
        reply_limit = int(reply_limit_raw) if reply_limit_raw.isdigit() else 5
        reply_limit = max(1, min(reply_limit, 20))

        root_posts_qs = CommunityPost.objects.filter(
            parent__isnull=True,
            is_deleted=False
        ).select_related('user', 'persona').annotate(
            reply_count=Count('replies', filter=Q(replies__is_deleted=False))
        ).order_by('-id')[:limit]
        root_posts = list(root_posts_qs)
        root_ids = [post.id for post in root_posts]

        replies_by_parent: dict[int, list[CommunityPost]] = {}
        if root_ids:
            replies = list(
                CommunityPost.objects.filter(parent_id__in=root_ids, is_deleted=False)
                .select_related('user', 'persona')
                .order_by('created_at')[: max(len(root_ids) * reply_limit, reply_limit)]
            )
            for reply in replies:
                if reply.parent_id not in replies_by_parent:
                    replies_by_parent[reply.parent_id] = []
                if len(replies_by_parent[reply.parent_id]) < reply_limit:
                    replies_by_parent[reply.parent_id].append(reply)

        feed_payload = []
        for post in root_posts:
            serialized_post = CommunityPostSerializer(post).data
            post_replies = replies_by_parent.get(post.id, [])
            feed_payload.append({
                'post': serialized_post,
                'reply_count': int(getattr(post, 'reply_count', len(post_replies)) or 0),
                'replies': CommunityPostSerializer(post_replies, many=True).data
            })

        actor_role = 'agent' if has_agent_access(request) else 'user'
        personas = CommunityPersona.objects.filter(is_active=True).order_by('sort_order', 'display_name')[:120]
        serialized_personas = CommunityPersonaSerializer(personas, many=True, context={'actor_role': actor_role}).data
        return Response({
            'safety_rules': COMMUNITY_SAFETY_RULES,
            'ghost_members': serialized_personas,
            'personas': serialized_personas,
            'settings': CommunitySettingsSerializer(settings_obj).data,
            'feed': feed_payload
        }, status=status.HTTP_200_OK)

    def post(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        serializer = CommunityPostCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        parent_id = serializer.validated_data.get('parent_id')
        parent = None
        if parent_id:
            parent = CommunityPost.objects.filter(id=parent_id, is_deleted=False).first()
            if parent is None:
                return Response({'parent_id': 'Parent post not found.'}, status=status.HTTP_404_NOT_FOUND)
            if parent.parent_id is not None:
                return Response({'parent_id': 'Reply depth exceeded. Reply to question directly.'}, status=status.HTTP_400_BAD_REQUEST)

        content = serializer.validated_data['content']
        media_file = serializer.validated_data.get('media_file')
        sanitized_content, content_masked, moderation_note = mask_restricted_content(content)

        is_agent = has_agent_access(request)
        persona = None
        author_type = CommunityPost.AUTHOR_USER
        author_user = request.user

        if is_agent:
            ghost_member_id = serializer.validated_data.get('ghost_member_id')
            if not ghost_member_id:
                return Response({'ghost_member_id': 'ghost_member_id is required for agent community messages.'}, status=status.HTTP_400_BAD_REQUEST)
            persona = CommunityPersona.objects.filter(id=ghost_member_id, is_active=True).first()
            if persona is None:
                return Response({'ghost_member_id': 'Ghost member not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)
            author_type = CommunityPost.AUTHOR_PERSONA
            author_user = None

        post = CommunityPost.objects.create(
            author_type=author_type,
            user=author_user,
            persona=persona,
            parent=parent,
            content=sanitized_content,
            content_masked=content_masked,
            moderation_note=moderation_note,
            media_file=media_file if media_file else None,
            media_name=getattr(media_file, 'name', '') if media_file else ''
        )

        if content_masked:
            log_moderation_event(
                user=request.user,
                context=ModerationEvent.CONTEXT_COMMUNITY,
                action=ModerationEvent.ACTION_MASKED,
                reason=moderation_note or 'Restricted contact details were masked.',
                channel_ref=f'community_post:{post.id}',
                original_excerpt=content,
                sanitized_excerpt=sanitized_content
            )

        return Response({
            'message': 'Community post published.',
            'post': CommunityPostSerializer(post).data,
            'content_masked': content_masked,
            'moderation_note': moderation_note
        }, status=status.HTTP_201_CREATED)


class GhostChatThreadsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        latest_visible_messages = GhostChatMessage.objects.filter(
            thread=OuterRef('pk'),
            deleted_for_everyone=False
        ).order_by('-created_at')

        if has_agent_access(request):
            search = str(request.query_params.get('search') or '').strip()
            persona_id = str(request.query_params.get('persona_id') or '').strip()
            favorites_only = str(request.query_params.get('favorites_only') or '').strip().lower() in ['1', 'true', 'yes']

            threads = GhostChatThread.objects.select_related('user', 'persona')
            if search:
                threads = threads.filter(
                    Q(user__first_name__icontains=search) |
                    Q(user__last_name__icontains=search) |
                    Q(user__email__icontains=search) |
                    Q(user__mobile_number__icontains=search) |
                    Q(persona__display_name__icontains=search) |
                    Q(persona__ghost_id__icontains=search) |
                    Q(persona__identity_tag__icontains=search)
                )
            if persona_id.isdigit():
                threads = threads.filter(persona_id=int(persona_id))
            if favorites_only:
                threads = threads.filter(is_favorite=True)

            threads = threads.annotate(
                unread_for_agent=Count(
                    'messages',
                    filter=Q(
                        messages__sender_role=GhostChatMessage.SENDER_USER,
                        messages__read_by_agent=False,
                        messages__deleted_for_everyone=False
                    )
                ),
                unread_for_user=Count(
                    'messages',
                    filter=Q(
                        messages__sender_role=GhostChatMessage.SENDER_AGENT,
                        messages__read_by_user=False,
                        messages__deleted_for_everyone=False
                    )
                ),
                last_message_id=Subquery(latest_visible_messages.values('id')[:1]),
                last_message_type=Subquery(latest_visible_messages.values('message_type')[:1]),
                last_message_content=Subquery(latest_visible_messages.values('content')[:1]),
                last_message_media_name=Subquery(latest_visible_messages.values('media_name')[:1]),
                last_message_created=Subquery(latest_visible_messages.values('created_at')[:1])
            ).order_by('-is_favorite', '-last_message_at', '-id')[:240]

            payload = []
            for thread in threads:
                last_message_type = str(getattr(thread, 'last_message_type', '') or '')
                last_message_content = str(getattr(thread, 'last_message_content', '') or '').strip()
                last_message_media_name = str(getattr(thread, 'last_message_media_name', '') or '').strip()
                if last_message_type == GhostChatMessage.TYPE_MEDIA:
                    preview = f'Media: {last_message_media_name or "Attachment"}'
                else:
                    preview = last_message_content or 'No messages yet'

                payload.append({
                    'thread_id': str(thread.id),
                    'user_id': str(thread.user_id),
                    'user_name': get_user_display_name(thread.user),
                    'user_email': str(thread.user.email or '').strip(),
                    'user_mobile': str(thread.user.mobile_number or '').strip(),
                    'user_last_login': thread.user.last_login.isoformat() if thread.user.last_login else None,
                    'user_last_seen_at': thread.user.last_seen_at.isoformat() if thread.user.last_seen_at else None,
                    'user_is_active_now': is_user_active_now(thread.user),
                    'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': 'agent'}).data,
                    'is_persona_locked': bool(thread.is_persona_locked),
                    'is_favorite': bool(thread.is_favorite),
                    'unread_for_agent': int(getattr(thread, 'unread_for_agent', 0) or 0),
                    'unread_for_user': int(getattr(thread, 'unread_for_user', 0) or 0),
                    'last_message': {
                        'id': getattr(thread, 'last_message_id', None),
                        'type': last_message_type or None,
                        'preview': preview,
                        'created_at': getattr(thread, 'last_message_created', None).isoformat() if getattr(thread, 'last_message_created', None) else None
                    },
                    'last_message_at': thread.last_message_at.isoformat() if thread.last_message_at else None
                })
            return Response({'threads': payload}, status=status.HTTP_200_OK)

        threads = GhostChatThread.objects.filter(user=request.user).select_related('persona').annotate(
            unread_for_user=Count(
                'messages',
                filter=Q(
                    messages__sender_role=GhostChatMessage.SENDER_AGENT,
                    messages__read_by_user=False,
                    messages__deleted_for_everyone=False
                )
            ),
            last_message_id=Subquery(latest_visible_messages.values('id')[:1]),
            last_message_type=Subquery(latest_visible_messages.values('message_type')[:1]),
            last_message_content=Subquery(latest_visible_messages.values('content')[:1]),
            last_message_media_name=Subquery(latest_visible_messages.values('media_name')[:1]),
            last_message_created=Subquery(latest_visible_messages.values('created_at')[:1])
        ).order_by('-last_message_at', '-id')[:240]

        payload = []
        for thread in threads:
            last_message_type = str(getattr(thread, 'last_message_type', '') or '')
            last_message_content = str(getattr(thread, 'last_message_content', '') or '').strip()
            last_message_media_name = str(getattr(thread, 'last_message_media_name', '') or '').strip()
            if last_message_type == GhostChatMessage.TYPE_MEDIA:
                preview = f'Media: {last_message_media_name or "Attachment"}'
            else:
                preview = last_message_content or 'No messages yet'

            payload.append({
                'thread_id': str(thread.id),
                'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': 'user'}).data,
                'is_persona_locked': bool(thread.is_persona_locked),
                'unread_for_user': int(getattr(thread, 'unread_for_user', 0) or 0),
                'last_message': {
                    'id': getattr(thread, 'last_message_id', None),
                    'type': last_message_type or None,
                    'preview': preview,
                    'created_at': getattr(thread, 'last_message_created', None).isoformat() if getattr(thread, 'last_message_created', None) else None
                },
                'last_message_at': thread.last_message_at.isoformat() if thread.last_message_at else None
            })

        return Response({
            'threads': payload,
            'safety_rules': COMMUNITY_SAFETY_RULES
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if has_agent_access(request):
            return Response({'error': 'Agent cannot create thread from this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = GhostThreadCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        persona = CommunityPersona.objects.filter(
            id=serializer.validated_data['persona_id'],
            is_active=True
        ).first()
        if persona is None:
            return Response({'persona_id': 'Persona not found or inactive.'}, status=status.HTTP_404_NOT_FOUND)

        thread, created = GhostChatThread.objects.get_or_create(
            user=request.user,
            persona=persona,
            defaults={'is_persona_locked': True}
        )

        if created:
            system_message = GhostChatMessage.objects.create(
                thread=thread,
                sender_role=GhostChatMessage.SENDER_SYSTEM,
                sender_label='System',
                message_type=GhostChatMessage.TYPE_TEXT,
                content=f'You are now connected with {persona.display_name}.',
                read_by_user=True,
                read_by_agent=True
            )
            thread.last_message_at = system_message.created_at
            thread.save(update_fields=['last_message_at'])

        return Response({
            'message': 'Private chat thread ready.',
            'thread': {
                'thread_id': str(thread.id),
                'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': 'user'}).data,
                'is_persona_locked': bool(thread.is_persona_locked),
                'last_message_at': thread.last_message_at.isoformat() if thread.last_message_at else None
            }
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class GhostChatThreadFromCommunityView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if has_agent_access(request):
            return Response({'error': 'Agent cannot create private thread from this endpoint.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = GhostThreadFromCommunitySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        community_post_id = serializer.validated_data['community_post_id']
        post = CommunityPost.objects.select_related('persona').filter(id=community_post_id, is_deleted=False).first()
        if post is None:
            return Response({'community_post_id': 'Community post not found.'}, status=status.HTTP_404_NOT_FOUND)
        if post.author_type != CommunityPost.AUTHOR_PERSONA or post.persona is None:
            return Response({'community_post_id': 'Private reply is available only on ghost member messages.'}, status=status.HTTP_400_BAD_REQUEST)

        thread, created = GhostChatThread.objects.get_or_create(
            user=request.user,
            persona=post.persona,
            defaults={'is_persona_locked': True}
        )

        if created:
            system_message = GhostChatMessage.objects.create(
                thread=thread,
                sender_role=GhostChatMessage.SENDER_SYSTEM,
                sender_label='System',
                message_type=GhostChatMessage.TYPE_TEXT,
                content=f'You are now connected with {post.persona.display_name}.',
                read_by_user=True,
                read_by_agent=True
            )
            thread.last_message_at = system_message.created_at
            thread.save(update_fields=['last_message_at'])

        return Response({
            'message': 'Private chat thread ready.',
            'thread': {
                'thread_id': str(thread.id),
                'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': 'user'}).data,
                'is_persona_locked': bool(thread.is_persona_locked),
                'last_message_at': thread.last_message_at.isoformat() if thread.last_message_at else None
            }
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class GhostChatThreadDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, thread_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can manage ghost thread settings.'}, status=status.HTTP_403_FORBIDDEN)

        thread = GhostChatThread.objects.select_related('persona', 'user').filter(id=thread_id).first()
        if thread is None:
            return Response({'error': 'Thread not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = GhostThreadManageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        updates = {}
        persona_changed = False
        admin_override = bool(serializer.validated_data.get('admin_override'))
        if 'persona_id' in serializer.validated_data:
            next_persona_id = int(serializer.validated_data['persona_id'])
            if thread.is_persona_locked and not admin_override and next_persona_id != thread.persona_id:
                return Response({
                    'error': 'Persona is locked for this thread. Use admin override to change.'
                }, status=status.HTTP_400_BAD_REQUEST)

            next_persona = CommunityPersona.objects.filter(id=next_persona_id).first()
            if next_persona is None:
                return Response({'persona_id': 'Persona not found.'}, status=status.HTTP_404_NOT_FOUND)

            if next_persona.id != thread.persona_id:
                thread.persona = next_persona
                updates['persona'] = next_persona
                persona_changed = True

        if 'is_persona_locked' in serializer.validated_data:
            thread.is_persona_locked = bool(serializer.validated_data['is_persona_locked'])
            updates['is_persona_locked'] = thread.is_persona_locked

        if 'is_favorite' in serializer.validated_data:
            thread.is_favorite = bool(serializer.validated_data['is_favorite'])
            updates['is_favorite'] = thread.is_favorite

        if updates:
            thread.save(update_fields=list(updates.keys()) + ['updated_at'])

        if persona_changed:
            system_message = GhostChatMessage.objects.create(
                thread=thread,
                sender_role=GhostChatMessage.SENDER_SYSTEM,
                sender_label='System',
                message_type=GhostChatMessage.TYPE_TEXT,
                content=f'Agent changed thread persona to {thread.persona.display_name}.',
                read_by_user=True,
                read_by_agent=True
            )
            thread.last_message_at = system_message.created_at
            thread.save(update_fields=['last_message_at'])

        return Response({
            'message': 'Ghost thread updated.',
            'thread': {
                'thread_id': str(thread.id),
                'user_id': str(thread.user_id),
                'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': 'agent'}).data,
                'is_persona_locked': bool(thread.is_persona_locked),
                'is_favorite': bool(thread.is_favorite),
                'last_message_at': thread.last_message_at.isoformat() if thread.last_message_at else None
            }
        }, status=status.HTTP_200_OK)

    def delete(self, request, thread_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can delete ghost chats.'}, status=status.HTTP_403_FORBIDDEN)

        thread = GhostChatThread.objects.filter(id=thread_id).first()
        if thread is None:
            return Response({'error': 'Thread not found.'}, status=status.HTTP_404_NOT_FOUND)

        deleted_count = delete_ghost_messages_for_thread(thread)
        thread.delete()
        return Response({
            'message': 'Ghost chat deleted successfully.',
            'thread_id': str(thread_id),
            'deleted_messages': deleted_count
        }, status=status.HTTP_200_OK)


class GhostChatMessagesView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        thread_id_raw = str(request.query_params.get('thread_id') or '').strip()
        if not thread_id_raw.isdigit():
            return Response({'thread_id': 'thread_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        thread = resolve_ghost_thread(request, int(thread_id_raw))
        if thread is None:
            return Response({'error': 'Thread not found.'}, status=status.HTTP_404_NOT_FOUND)

        since_id_raw = str(request.query_params.get('since_id') or '').strip()
        since_id = int(since_id_raw) if since_id_raw.isdigit() else None

        limit_raw = str(request.query_params.get('limit') or '').strip()
        limit = int(limit_raw) if limit_raw.isdigit() else 120
        limit = max(20, min(limit, 300))

        base_qs = GhostChatMessage.objects.filter(
            thread=thread,
            deleted_for_everyone=False
        ).order_by('id')

        if since_id is not None and since_id > 0:
            messages_qs = base_qs.filter(id__gt=since_id)
        else:
            recent_ids = list(base_qs.order_by('-id').values_list('id', flat=True)[:limit])
            messages_qs = base_qs.filter(id__in=recent_ids)

        messages = list(messages_qs.order_by('id'))
        actor_role = 'agent' if has_agent_access(request) else 'user'
        serializer = GhostMessageSerializer(messages, many=True, context={'actor_role': actor_role})

        if actor_role == 'agent':
            GhostChatMessage.objects.filter(
                thread=thread,
                sender_role=GhostChatMessage.SENDER_USER,
                read_by_agent=False,
                deleted_for_everyone=False
            ).update(read_by_agent=True)
        else:
            GhostChatMessage.objects.filter(
                thread=thread,
                read_by_user=False,
                deleted_for_everyone=False
            ).exclude(sender_role=GhostChatMessage.SENDER_USER).update(read_by_user=True)

        return Response({
            'thread_id': str(thread.id),
            'persona': CommunityPersonaSerializer(thread.persona, context={'actor_role': actor_role}).data,
            'is_persona_locked': bool(thread.is_persona_locked),
            'messages': serializer.data
        }, status=status.HTTP_200_OK)

    def post(self, request):
        request.user.last_seen_at = timezone.now()
        request.user.save(update_fields=['last_seen_at'])

        serializer = GhostMessageCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        thread = resolve_ghost_thread(request, serializer.validated_data['thread_id'])
        if thread is None:
            return Response({'error': 'Thread not found.'}, status=status.HTTP_404_NOT_FOUND)

        raw_content = serializer.validated_data.get('content', '')
        media_file = serializer.validated_data.get('media_file')
        sanitized_content, content_masked, moderation_note = mask_restricted_content(raw_content)

        is_agent = has_agent_access(request)
        message = GhostChatMessage.objects.create(
            thread=thread,
            sender_role=GhostChatMessage.SENDER_AGENT if is_agent else GhostChatMessage.SENDER_USER,
            sender_label=thread.persona.display_name if is_agent else get_user_display_name(request.user),
            message_type=GhostChatMessage.TYPE_MEDIA if media_file else GhostChatMessage.TYPE_TEXT,
            content=sanitized_content,
            content_masked=content_masked,
            moderation_note=moderation_note,
            media_file=media_file if media_file else None,
            media_name=getattr(media_file, 'name', '') if media_file else '',
            read_by_user=not is_agent,
            read_by_agent=is_agent
        )

        thread.last_message_at = message.created_at
        thread.save(update_fields=['last_message_at'])

        if content_masked:
            log_moderation_event(
                user=request.user,
                context=ModerationEvent.CONTEXT_PRIVATE_CHAT,
                action=ModerationEvent.ACTION_MASKED,
                reason=moderation_note or 'Restricted contact details were masked.',
                channel_ref=f'ghost_thread:{thread.id}',
                original_excerpt=raw_content,
                sanitized_excerpt=sanitized_content
            )

        out = GhostMessageSerializer(message, context={'actor_role': 'agent' if is_agent else 'user'})
        return Response({
            'message': out.data,
            'content_masked': content_masked,
            'moderation_note': moderation_note
        }, status=status.HTTP_201_CREATED)


class GhostChatDeleteMessageView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, message_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Only agent can delete ghost chat messages.'}, status=status.HTTP_403_FORBIDDEN)

        message = GhostChatMessage.objects.filter(id=message_id, deleted_for_everyone=False).first()
        if message is None:
            return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)

        message.deleted_for_everyone = True
        message.deleted_by_agent = True
        message.deleted_at = timezone.now()
        message.save(update_fields=['deleted_for_everyone', 'deleted_by_agent', 'deleted_at'])
        return Response({'message': 'Deleted for everyone'}, status=status.HTTP_200_OK)


class UserAnnouncementsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Announcement.objects.filter(is_active=True).filter(
            Q(type=Announcement.TYPE_GLOBAL) |
            Q(type=Announcement.TYPE_PRIVATE, target_user=request.user)
        ).select_related('target_user').order_by('-created_at')[:30]

        serializer = AnnouncementSerializer(queryset, many=True)
        return Response({'announcements': serializer.data}, status=status.HTTP_200_OK)


class AgentAnnouncementCollectionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        search = str(request.query_params.get('search') or '').strip()
        ann_type = str(request.query_params.get('type') or '').strip().upper()
        target_user_id = str(request.query_params.get('target_user_id') or '').strip()

        queryset = Announcement.objects.filter(is_active=True).select_related('target_user').order_by('-created_at')

        if ann_type in [Announcement.TYPE_GLOBAL, Announcement.TYPE_PRIVATE]:
            queryset = queryset.filter(type=ann_type)
        if target_user_id:
            queryset = queryset.filter(target_user_id=target_user_id)
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(cta_text__icontains=search) |
                Q(target_user__first_name__icontains=search) |
                Q(target_user__last_name__icontains=search) |
                Q(target_user__email__icontains=search) |
                Q(target_user__mobile_number__icontains=search)
            )

        announcements = list(queryset[:400])
        serializer = AnnouncementSerializer(announcements, many=True)
        return Response({
            'announcements': serializer.data,
            'counts': build_announcement_counts_payload()
        }, status=status.HTTP_200_OK)

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AnnouncementCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        ann_type = serializer.validated_data['type']
        target_user = None
        target_user_id = str(serializer.validated_data.get('target_user_id') or '').strip()

        if ann_type == Announcement.TYPE_PRIVATE:
            target_user = CustomUser.objects.filter(id=target_user_id, is_admin=False).first()
            if target_user is None:
                return Response({'target_user_id': 'Target user not found.'}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            if ann_type == Announcement.TYPE_GLOBAL:
                active_global = Announcement.objects.filter(
                    is_active=True,
                    type=Announcement.TYPE_GLOBAL
                ).count()
                if active_global >= MAX_ACTIVE_GLOBAL_ANNOUNCEMENTS:
                    return Response(
                        {'error': 'Maximum 2 active global announcements allowed.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                active_private_for_user = Announcement.objects.filter(
                    is_active=True,
                    type=Announcement.TYPE_PRIVATE,
                    target_user=target_user
                ).count()
                if active_private_for_user >= MAX_ACTIVE_PRIVATE_ANNOUNCEMENTS_PER_USER:
                    return Response(
                        {'error': 'Maximum 2 active private announcements allowed per user.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            announcement = Announcement.objects.create(
                type=ann_type,
                target_user=target_user if ann_type == Announcement.TYPE_PRIVATE else None,
                title=serializer.validated_data['title'],
                description=serializer.validated_data['description'],
                cta_text=serializer.validated_data['cta_text'],
                priority_label=serializer.validated_data.get('priority_label', 'IMPORTANT'),
                is_active=True,
                created_by=request.user
            )

        return Response({
            'message': 'Announcement created successfully.',
            'announcement': AnnouncementSerializer(announcement).data,
            'counts': build_announcement_counts_payload()
        }, status=status.HTTP_201_CREATED)


class AgentAnnouncementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, announcement_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        announcement = Announcement.objects.filter(id=announcement_id).select_related('target_user').first()
        if announcement is None:
            return Response({'error': 'Announcement not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AnnouncementUpdateSerializer(data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_type = str(serializer.validated_data.get('type') or announcement.type).strip().upper()
        next_is_active = bool(serializer.validated_data.get('is_active', announcement.is_active))
        next_target_user = announcement.target_user

        if next_type == Announcement.TYPE_PRIVATE:
            if 'target_user_id' in serializer.validated_data:
                target_user_id = str(serializer.validated_data.get('target_user_id') or '').strip()
                if not target_user_id:
                    return Response({'target_user_id': 'Target user is required for private announcements.'}, status=status.HTTP_400_BAD_REQUEST)
                next_target_user = CustomUser.objects.filter(id=target_user_id, is_admin=False).first()
                if next_target_user is None:
                    return Response({'target_user_id': 'Target user not found.'}, status=status.HTTP_404_NOT_FOUND)
            elif next_target_user is None:
                return Response({'target_user_id': 'Target user is required for private announcements.'}, status=status.HTTP_400_BAD_REQUEST)
        elif next_type == Announcement.TYPE_GLOBAL:
            next_target_user = None
        else:
            return Response({'type': 'Invalid announcement type.'}, status=status.HTTP_400_BAD_REQUEST)

        if next_is_active:
            if next_type == Announcement.TYPE_GLOBAL:
                global_active = Announcement.objects.filter(
                    is_active=True,
                    type=Announcement.TYPE_GLOBAL
                ).exclude(id=announcement.id).count()
                if global_active >= MAX_ACTIVE_GLOBAL_ANNOUNCEMENTS:
                    return Response(
                        {'error': 'Maximum 2 active global announcements allowed.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            else:
                private_active_for_user = Announcement.objects.filter(
                    is_active=True,
                    type=Announcement.TYPE_PRIVATE,
                    target_user=next_target_user
                ).exclude(id=announcement.id).count()
                if private_active_for_user >= MAX_ACTIVE_PRIVATE_ANNOUNCEMENTS_PER_USER:
                    return Response(
                        {'error': 'Maximum 2 active private announcements allowed per user.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

        update_fields = []
        if announcement.type != next_type:
            announcement.type = next_type
            update_fields.append('type')
        if announcement.target_user_id != (next_target_user.id if next_target_user else None):
            announcement.target_user = next_target_user
            update_fields.append('target_user')

        for field_name in ['title', 'description', 'cta_text', 'priority_label', 'is_active']:
            if field_name in serializer.validated_data:
                value = serializer.validated_data[field_name]
                if getattr(announcement, field_name) != value:
                    setattr(announcement, field_name, value)
                    update_fields.append(field_name)

        if update_fields:
            update_fields.append('updated_at')
            announcement.save(update_fields=update_fields)

        return Response({
            'message': 'Announcement updated successfully.',
            'announcement': AnnouncementSerializer(announcement).data,
            'counts': build_announcement_counts_payload()
        }, status=status.HTTP_200_OK)

    def delete(self, request, announcement_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        announcement = Announcement.objects.filter(id=announcement_id).first()
        if announcement is None:
            return Response({'error': 'Announcement not found.'}, status=status.HTTP_404_NOT_FOUND)

        announcement.delete()
        return Response({
            'message': 'Announcement deleted successfully.',
            'counts': build_announcement_counts_payload()
        }, status=status.HTTP_200_OK)


class AgentGlobalPaymentConfigView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        purge_expired_global_payment_configs()
        now = timezone.now()
        configs = GlobalPaymentConfig.objects.filter(is_active=True, expires_at__gt=now).order_by('-created_at')[:25]
        serializer = GlobalPaymentConfigSerializer(configs, many=True, context={'now': now})
        return Response({'configs': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = GlobalPaymentConfigCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        purge_expired_global_payment_configs()
        purge_old_payment_templates()
        delete_global_payment_records(GlobalPaymentConfig.objects.filter(is_active=True))

        now = timezone.now()
        expires_at = now + timedelta(minutes=GLOBAL_PAYMENT_VALIDITY_MINUTES)

        bank_payload = {
            'account_holder_name': str(serializer.validated_data.get('account_holder_name') or '').strip(),
            'bank_name': str(serializer.validated_data.get('bank_name') or '').strip(),
            'account_number': str(serializer.validated_data.get('account_number') or '').strip(),
            'ifsc': str(serializer.validated_data.get('ifsc') or '').strip().upper(),
            'branch': str(serializer.validated_data.get('branch') or '').strip()
        }

        config = GlobalPaymentConfig.objects.create(
            qr_image=serializer.validated_data.get('qr_image'),
            account_holder_name=bank_payload['account_holder_name'],
            bank_name=bank_payload['bank_name'],
            account_number=bank_payload['account_number'],
            ifsc=bank_payload['ifsc'],
            branch=bank_payload['branch'],
            created_by=request.user,
            expires_at=expires_at,
            is_active=True
        )

        template = PaymentConfigTemplate(
            account_holder_name=bank_payload['account_holder_name'],
            bank_name=bank_payload['bank_name'],
            account_number=bank_payload['account_number'],
            ifsc=bank_payload['ifsc'],
            branch=bank_payload['branch'],
            created_by=request.user
        )
        if config.qr_image:
            qr_copy = clone_uploaded_file(config.qr_image, 'template')
            if qr_copy:
                template.qr_image = qr_copy
        template.save()

        out = GlobalPaymentConfigSerializer(config, context={'now': now})
        return Response({
            'message': 'Global payment config uploaded successfully.',
            'config': out.data
        }, status=status.HTTP_201_CREATED)


class AgentGlobalPaymentConfigDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, config_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        config = GlobalPaymentConfig.objects.filter(id=config_id).first()
        if config is None:
            return Response({'error': 'Config not found'}, status=status.HTTP_404_NOT_FOUND)

        delete_global_payment_records(GlobalPaymentConfig.objects.filter(id=config.id))
        return Response({'message': 'Global payment config deleted.'}, status=status.HTTP_200_OK)


class ActiveGlobalPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        purge_expired_global_payment_configs()
        now = timezone.now()
        active = GlobalPaymentConfig.objects.filter(
            is_active=True,
            expires_at__gt=now
        ).order_by('-created_at').first()

        if active is None:
            return Response({
                'active_payment': None,
                'message': 'Payment details are being updated. Please refresh or try again in a few minutes.'
            }, status=status.HTTP_200_OK)

        return Response({
            'active_payment': {
                'set_id': str(active.id),
                'scope': 'global',
                'user_id': str(request.user.id),
                'qr_image_url': active.qr_image.url if active.qr_image else '',
                'bank': {
                    'accountHolderName': str(active.account_holder_name or ''),
                    'bankName': str(active.bank_name or ''),
                    'accountNumber': str(active.account_number or ''),
                    'ifsc': str(active.ifsc or ''),
                    'branch': active.branch or ''
                },
                'has_qr': bool(active.qr_image),
                'has_bank': has_bank_details(active),
                'starts_at': active.created_at.isoformat(),
                'expires_at': active.expires_at.isoformat(),
                'status': 'active'
            }
        }, status=status.HTTP_200_OK)


class AgentPaymentTemplateCollectionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        purge_old_payment_templates()
        cutoff = timezone.now() - timedelta(hours=24)
        templates = PaymentConfigTemplate.objects.filter(created_at__gte=cutoff).order_by('-created_at')[:80]
        serializer = PaymentConfigTemplateSerializer(templates, many=True)
        return Response({'templates': serializer.data}, status=status.HTTP_200_OK)


class AgentPaymentTemplateDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, template_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        template = PaymentConfigTemplate.objects.filter(id=template_id).first()
        if template is None:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        purge_expired_global_payment_configs()
        delete_global_payment_records(GlobalPaymentConfig.objects.filter(is_active=True))

        now = timezone.now()
        expires_at = now + timedelta(minutes=GLOBAL_PAYMENT_VALIDITY_MINUTES)

        config = GlobalPaymentConfig(
            account_holder_name=str(template.account_holder_name or '').strip(),
            bank_name=str(template.bank_name or '').strip(),
            account_number=str(template.account_number or '').strip(),
            ifsc=str(template.ifsc or '').strip().upper(),
            branch=str(template.branch or '').strip(),
            created_by=request.user,
            expires_at=expires_at,
            is_active=True
        )

        if template.qr_image:
            qr_copy = clone_uploaded_file(template.qr_image, 'global-qr')
            if qr_copy:
                config.qr_image = qr_copy
        config.save()

        out = GlobalPaymentConfigSerializer(config, context={'now': now})
        return Response({
            'message': 'Template implemented successfully.',
            'config': out.data
        }, status=status.HTTP_200_OK)

    def delete(self, request, template_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        template = PaymentConfigTemplate.objects.filter(id=template_id).first()
        if template is None:
            return Response({'error': 'Template not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            if template.qr_image:
                template.qr_image.delete(save=False)
        except Exception:
            pass
        template.delete()
        return Response({'message': 'Template deleted successfully.'}, status=status.HTTP_200_OK)


class UserPaymentTransactionsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        queryset = PaymentTransaction.objects.filter(user=request.user).select_related('user').order_by('-created_at')[:120]
        serializer = PaymentTransactionSerializer(queryset, many=True)
        return Response({'transactions': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = PaymentTransactionCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        transaction_id = serializer.validated_data['transaction_id']
        exists = PaymentTransaction.objects.filter(
            user=request.user,
            transaction_id__iexact=transaction_id
        ).exists()
        if exists:
            return Response({'transaction_id': 'Transaction ID already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        tx = PaymentTransaction.objects.create(
            user=request.user,
            transaction_id=transaction_id,
            proof_image=serializer.validated_data['proof_image'],
            amount_inr=serializer.validated_data.get('amount_inr', 0),
            payment_set_id=str(serializer.validated_data.get('payment_set_id') or '').strip(),
            payment_scope=str(serializer.validated_data.get('payment_scope') or '').strip(),
            status=PaymentTransaction.STATUS_PENDING
        )

        out = PaymentTransactionSerializer(tx)
        return Response({
            'message': 'Transaction submitted successfully.',
            'transaction': out.data
        }, status=status.HTTP_201_CREATED)


class AgentPaymentTransactionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        search = str(request.query_params.get('search') or '').strip()
        queryset = PaymentTransaction.objects.select_related('user').order_by('-created_at')
        if search:
            queryset = queryset.filter(
                Q(user__first_name__icontains=search) |
                Q(user__last_name__icontains=search) |
                Q(user__mobile_number__icontains=search) |
                Q(user__email__icontains=search) |
                Q(transaction_id__icontains=search)
            )
        serializer = PaymentTransactionSerializer(queryset[:240], many=True)
        return Response({'transactions': serializer.data}, status=status.HTTP_200_OK)


class AgentPaymentTransactionDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, transaction_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        tx = PaymentTransaction.objects.filter(id=transaction_id).first()
        if tx is None:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = PaymentTransactionStatusSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        tx.status = serializer.validated_data['status']
        tx.reviewed_by = request.user
        tx.reviewed_at = timezone.now()
        tx.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'updated_at'])

        out = PaymentTransactionSerializer(tx)
        return Response({
            'message': 'Transaction status updated.',
            'transaction': out.data
        }, status=status.HTTP_200_OK)

    def delete(self, request, transaction_id: int):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        tx = PaymentTransaction.objects.filter(id=transaction_id).first()
        if tx is None:
            return Response({'error': 'Transaction not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            if tx.proof_image:
                tx.proof_image.delete(save=False)
        except Exception:
            pass

        tx.delete()
        return Response({'message': 'Transaction deleted successfully.'}, status=status.HTTP_200_OK)


class AgentAgreementQuestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        questions = AgreementQuestion.objects.filter(is_active=True).order_by('question_id')[:20]
        serializer = AgreementQuestionSerializer(questions, many=True)
        return Response({'questions': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        raw_questions = request.data.get('questions', [])
        if not isinstance(raw_questions, list):
            return Response({'questions': 'questions must be a list'}, status=status.HTTP_400_BAD_REQUEST)
        if len(raw_questions) > 20:
            return Response({'questions': 'Maximum 20 questions allowed in one set.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AgreementQuestionInputSerializer(data=raw_questions, many=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        question_items = serializer.validated_data
        question_ids = [item['questionId'] for item in question_items]
        if len(question_ids) != len(set(question_ids)):
            return Response({'questions': 'Duplicate question IDs are not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            AgreementQuestion.objects.exclude(question_id__in=question_ids).update(is_active=False)

            for item in question_items:
                AgreementQuestion.objects.update_or_create(
                    question_id=item['questionId'],
                    defaults={
                        'description': item['description'],
                        'is_active': True
                    }
                )

        questions = AgreementQuestion.objects.filter(is_active=True).order_by('question_id')[:20]
        out = AgreementQuestionSerializer(questions, many=True)
        return Response({
            'message': 'Agreement question set saved successfully.',
            'questions': out.data
        }, status=status.HTTP_200_OK)


class AgentAgreementUserVisibilityView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AgreementVisibilityUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_id = str(serializer.validated_data['user_id']).strip()
        user = CustomUser.objects.filter(id=user_id, is_admin=False).first()
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        enabled = bool(serializer.validated_data['agreement_tab_enabled'])
        user.agreement_tab_enabled = enabled
        user.save(update_fields=['agreement_tab_enabled'])

        return Response({
            'message': 'Agreement visibility updated successfully.',
            'user_id': str(user.id),
            'agreement_tab_enabled': bool(user.agreement_tab_enabled)
        }, status=status.HTTP_200_OK)


class UserAgreementQuestionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not bool(request.user.agreement_tab_enabled):
            return Response({
                'error': 'Agreement section is currently disabled for your account.'
            }, status=status.HTTP_403_FORBIDDEN)

        state = build_user_agreement_questions(request.user)
        return Response(state, status=status.HTTP_200_OK)


class UserAgreementSubmitAnswersView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not bool(request.user.agreement_tab_enabled):
            return Response({
                'error': 'Agreement section is currently disabled for your account.'
            }, status=status.HTTP_403_FORBIDDEN)

        if is_agreement_complete(request.user):
            return Response({
                'error': 'Agreement already completed and locked.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = AgreementSubmitAnswersSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        answer_items = serializer.validated_data['answers']
        requested_question_ids = [item['questionId'] for item in answer_items]
        question_map = {
            question.question_id: question
            for question in AgreementQuestion.objects.filter(
                is_active=True,
                question_id__in=requested_question_ids
            ).order_by('question_id')
        }

        if len(question_map) != len(requested_question_ids):
            return Response({'answers': 'One or more question IDs are invalid or inactive.'}, status=status.HTTP_400_BAD_REQUEST)

        question_ids = [question.id for question in question_map.values()]
        existing_answers = AgreementAnswer.objects.filter(
            user=request.user,
            question_id__in=question_ids
        ).select_related('question')

        existing_by_question_id = {answer.question.question_id: answer for answer in existing_answers}
        created_count = 0

        with transaction.atomic():
            for answer_item in answer_items:
                qid = answer_item['questionId']
                if qid in existing_by_question_id:
                    continue

                AgreementAnswer.objects.create(
                    user=request.user,
                    question=question_map[qid],
                    answer=(answer_item['answer'] == 'yes')
                )
                created_count += 1

        state = build_user_agreement_questions(request.user)
        return Response({
            'message': 'Agreement answers saved successfully.',
            'created_answers': created_count,
            **state
        }, status=status.HTTP_200_OK)


class UserAgreementCompleteView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        if not bool(request.user.agreement_tab_enabled):
            return Response({
                'error': 'Agreement section is currently disabled for your account.'
            }, status=status.HTTP_403_FORBIDDEN)

        if is_agreement_complete(request.user):
            return Response({
                'error': 'Agreement already completed and locked.'
            }, status=status.HTTP_400_BAD_REQUEST)

        serializer = AgreementCompleteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        answers_json = str(serializer.validated_data.get('answers_json') or '').strip()
        answer_items = []
        if answers_json:
            try:
                answer_items = json.loads(answers_json)
            except Exception:
                return Response({'answers_json': 'Invalid answers payload.'}, status=status.HTTP_400_BAD_REQUEST)

        if answer_items:
            answer_serializer = AgreementAnswerInputSerializer(data=answer_items, many=True)
            if not answer_serializer.is_valid():
                return Response({'answers': answer_serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
            answer_items = answer_serializer.validated_data
            incoming_ids = [int(item['questionId']) for item in answer_items]
            if len(incoming_ids) != len(set(incoming_ids)):
                return Response({'answers': 'Duplicate question ids are not allowed.'}, status=status.HTTP_400_BAD_REQUEST)

        active_questions = list(AgreementQuestion.objects.filter(is_active=True).order_by('question_id')[:20])
        if not active_questions:
            return Response({'error': 'No active agreement questions found.'}, status=status.HTTP_400_BAD_REQUEST)

        question_by_qid = {q.question_id: q for q in active_questions}
        active_question_ids = [q.question_id for q in active_questions]

        existing_answers = AgreementAnswer.objects.filter(
            user=request.user,
            question__question_id__in=active_question_ids
        ).select_related('question')
        existing_qids = {answer.question.question_id for answer in existing_answers}

        incoming_by_qid = {int(item['questionId']): item for item in answer_items}

        invalid_ids = [qid for qid in incoming_by_qid.keys() if qid not in question_by_qid]
        if invalid_ids:
            return Response({
                'answers': f'Invalid question ids in payload: {invalid_ids}'
            }, status=status.HTTP_400_BAD_REQUEST)

        missing_qids = [qid for qid in active_question_ids if qid not in existing_qids]
        unresolved = [qid for qid in missing_qids if qid not in incoming_by_qid]
        if unresolved:
            return Response({
                'answers': f'Please provide answers for all pending questions: {unresolved}'
            }, status=status.HTTP_400_BAD_REQUEST)

        signature_image = serializer.validated_data.get('signature_image')
        consent_video = serializer.validated_data.get('consent_video')
        if signature_image is None and not request.user.agreement_signature:
            return Response({'signature_image': 'Digital signature is required.'}, status=status.HTTP_400_BAD_REQUEST)
        if consent_video is None and not request.user.agreement_consent_video:
            return Response({'consent_video': 'Agreement consent video is required.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for qid in missing_qids:
                incoming = incoming_by_qid.get(qid)
                if not incoming:
                    continue
                AgreementAnswer.objects.create(
                    user=request.user,
                    question=question_by_qid[qid],
                    answer=(incoming['answer'] == 'yes')
                )

            if signature_image is not None:
                try:
                    if request.user.agreement_signature:
                        request.user.agreement_signature.delete(save=False)
                except Exception:
                    pass
                request.user.agreement_signature = signature_image

            if consent_video is not None:
                try:
                    if request.user.agreement_consent_video:
                        request.user.agreement_consent_video.delete(save=False)
                except Exception:
                    pass
                request.user.agreement_consent_video = consent_video

            request.user.agreement_completed_at = timezone.now()
            request.user.save(update_fields=['agreement_signature', 'agreement_consent_video', 'agreement_completed_at'])

        state = build_user_agreement_questions(request.user)
        return Response({
            'message': 'Agreement completed successfully.',
            **state
        }, status=status.HTTP_200_OK)


class AgentAgreementResetUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not has_agent_access(request):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        serializer = AgreementResetUserSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user_id = str(serializer.validated_data['user_id']).strip()
        user = CustomUser.objects.filter(id=user_id, is_admin=False).first()
        if user is None:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        deleted_count, _ = AgreementAnswer.objects.filter(user=user).delete()
        try:
            if user.agreement_signature:
                user.agreement_signature.delete(save=False)
        except Exception:
            pass
        try:
            if user.agreement_consent_video:
                user.agreement_consent_video.delete(save=False)
        except Exception:
            pass
        user.agreement_completed_at = None
        user.save(update_fields=['agreement_signature', 'agreement_consent_video', 'agreement_completed_at'])

        return Response({
            'message': 'User agreement answers reset successfully.',
            'user_id': str(user.id),
            'deleted_answers': deleted_count
        }, status=status.HTTP_200_OK)
