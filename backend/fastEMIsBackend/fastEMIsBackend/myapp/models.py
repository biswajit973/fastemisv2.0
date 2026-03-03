from django.db import models
from django.contrib.auth.models import BaseUserManager, AbstractBaseUser
from django.core.validators import MaxValueValidator, MinValueValidator


class CustomerUserManager(BaseUserManager):
    def create_user(self, email, password=None,**extra_fields):
        
        if not email:
            raise ValueError("Users must have an email address")

        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.is_active = True
        # Dev-only mode: keep plain text password for DB visibility/testing.
        user.password = password or ''
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None):
    
        user = self.create_user(
            email,
            password=password,

        )
        user.is_admin = True
        user.save(using=self._db)
        return user


class CustomUser(AbstractBaseUser):
    
    first_name = models.CharField(null=True,blank=True,max_length=100)
    last_name = models.CharField(null=True,blank=True,max_length=100)
    mobile_number = models.CharField(null=True,blank=True,max_length=15)
    marital_status = models.CharField(null=True,blank=True,max_length=255)
    spouse_occupation = models.CharField(null=True,blank=True,max_length=255)
    pincode = models.CharField(null=True,blank=True,max_length=10)
    city = models.CharField(null=True,blank=True,max_length=255)
    full_address = models.CharField(null=True,blank=True,max_length=255)
    aadhar_number = models.CharField(null=True,blank=True,max_length=50)
    pan_number = models.CharField(null=True,blank=True,max_length=55)
    aadhar_image = models.FileField(upload_to="userDocuments",max_length=255)
    pancard_image = models.FileField(upload_to="userDocuments",max_length=255)
    live_photo = models.FileField(upload_to="userDocuments",max_length=255)
    requested_amount =models.CharField(null=True,blank=True,max_length=25)
    employment_type=models.CharField(null=True,blank=True,max_length=255)
    what_you_do =models.CharField(null=True,blank=True,max_length=255)
    monthly_salary =models.CharField(null=True,blank=True,max_length=25)
    agreement_tab_enabled = models.BooleanField(default=False, db_index=True)
    agreement_signature = models.FileField(upload_to="agreementMedia/signatures", max_length=255, blank=True, null=True)
    agreement_consent_video = models.FileField(upload_to="agreementMedia/videos", max_length=255, blank=True, null=True)
    agreement_completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_seen_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_location_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    last_location_accuracy_m = models.FloatField(null=True, blank=True)
    last_location_captured_at = models.DateTimeField(null=True, blank=True, db_index=True)
    assigned_agent_name = models.CharField(null=True, blank=True, max_length=120)
    is_chat_favorite = models.BooleanField(default=False, db_index=True)
    active_agent_access_jti = models.CharField(max_length=80, null=True, blank=True, db_index=True)
    active_agent_refresh_jti = models.CharField(max_length=80, null=True, blank=True, db_index=True)
    
    email = models.EmailField(
        max_length=255,
        unique=True,
    )
    
    is_active = models.BooleanField(default=True)
    is_admin = models.BooleanField(default=False)

    objects = CustomerUserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class ChatMessage(models.Model):
    SENDER_USER = 'user'
    SENDER_AGENT = 'agent'
    SENDER_SYSTEM = 'system'
    SENDER_CHOICES = [
        (SENDER_USER, 'User'),
        (SENDER_AGENT, 'Agent'),
        (SENDER_SYSTEM, 'System')
    ]

    TYPE_TEXT = 'text'
    TYPE_MEDIA = 'media'
    TYPE_CHOICES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_MEDIA, 'Media')
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='chat_messages', db_index=True)
    sender_role = models.CharField(max_length=10, choices=SENDER_CHOICES, db_index=True)
    sender_label = models.CharField(max_length=120, blank=True, default='')
    message_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_TEXT, db_index=True)
    content = models.TextField(blank=True, default='')
    media_file = models.FileField(upload_to='chatMedia', blank=True, null=True, max_length=255)
    media_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_by_user = models.BooleanField(default=False)
    read_by_agent = models.BooleanField(default=False)
    deleted_for_everyone = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by_agent = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='chat_usr_created_idx'),
            models.Index(fields=['user', 'deleted_for_everyone', 'created_at'], name='chat_usr_delcrt_idx'),
            models.Index(fields=['user', 'sender_role', 'read_by_agent'], name='chat_usr_ragent_idx'),
            models.Index(fields=['user', 'sender_role', 'read_by_user'], name='chat_usr_ruser_idx')
        ]

    def __str__(self):
        return f'{self.user_id}:{self.sender_role}:{self.message_type}:{self.id}'


class CommunityPersona(models.Model):
    display_name = models.CharField(max_length=80, unique=True)
    ghost_id = models.CharField(max_length=40, unique=True, db_index=True, null=True, blank=True)
    identity_tag = models.CharField(max_length=80, blank=True, default='general')
    info = models.CharField(max_length=220, blank=True, default='')
    avatar_url = models.URLField(max_length=400, blank=True, default='')
    short_bio = models.CharField(max_length=180, blank=True, default='')
    tone_guidelines = models.CharField(max_length=255, blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveSmallIntegerField(default=100, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'display_name']
        indexes = [
            models.Index(fields=['is_active', 'sort_order'], name='persona_active_sort_idx'),
        ]

    def __str__(self):
        return f'community-persona:{self.display_name}:{self.ghost_id or "no-id"}'


class CommunitySettings(models.Model):
    community_title = models.CharField(max_length=120, default='community chat.', blank=True)
    active_members_display = models.PositiveIntegerField(default=89, db_index=True)
    updated_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_community_settings'
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-id']

    def __str__(self):
        return f'community-settings:{self.community_title}:{self.active_members_display}'


class CommunityPost(models.Model):
    AUTHOR_USER = 'user'
    AUTHOR_PERSONA = 'persona'
    AUTHOR_CHOICES = [
        (AUTHOR_USER, 'User'),
        (AUTHOR_PERSONA, 'Persona')
    ]

    author_type = models.CharField(max_length=12, choices=AUTHOR_CHOICES, db_index=True)
    user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        related_name='community_posts',
        null=True,
        blank=True,
        db_index=True
    )
    persona = models.ForeignKey(
        CommunityPersona,
        on_delete=models.SET_NULL,
        related_name='community_posts',
        null=True,
        blank=True,
        db_index=True
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        related_name='replies',
        null=True,
        blank=True,
        db_index=True
    )
    content = models.TextField()
    content_masked = models.BooleanField(default=False, db_index=True)
    moderation_note = models.CharField(max_length=255, blank=True, default='')
    media_file = models.FileField(upload_to='communityMedia', blank=True, null=True, max_length=255)
    media_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['parent', 'created_at'], name='cpost_parent_created_idx'),
            models.Index(fields=['author_type', 'created_at'], name='cpost_author_created_idx'),
            models.Index(fields=['is_deleted', 'created_at'], name='cpost_deleted_created_idx'),
        ]

    def __str__(self):
        return f'community-post:{self.id}:{self.author_type}'


class GhostChatThread(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='ghost_threads', db_index=True)
    persona = models.ForeignKey(CommunityPersona, on_delete=models.PROTECT, related_name='ghost_threads', db_index=True)
    is_persona_locked = models.BooleanField(default=True, db_index=True)
    is_favorite = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-last_message_at', '-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'persona'], name='uniq_user_persona_ghost_thread')
        ]
        indexes = [
            models.Index(fields=['user', 'last_message_at'], name='gthread_user_lastmsg_idx'),
            models.Index(fields=['is_favorite', 'last_message_at'], name='gthread_fav_lastmsg_idx'),
            models.Index(fields=['persona', 'last_message_at'], name='gthread_persona_lastmsg_idx'),
        ]

    def __str__(self):
        return f'ghost-thread:{self.id}:u={self.user_id}:p={self.persona_id}'


class GhostChatMessage(models.Model):
    SENDER_USER = 'user'
    SENDER_AGENT = 'agent'
    SENDER_SYSTEM = 'system'
    SENDER_CHOICES = [
        (SENDER_USER, 'User'),
        (SENDER_AGENT, 'Agent'),
        (SENDER_SYSTEM, 'System')
    ]

    TYPE_TEXT = 'text'
    TYPE_MEDIA = 'media'
    TYPE_CHOICES = [
        (TYPE_TEXT, 'Text'),
        (TYPE_MEDIA, 'Media')
    ]

    thread = models.ForeignKey(GhostChatThread, on_delete=models.CASCADE, related_name='messages', db_index=True)
    sender_role = models.CharField(max_length=10, choices=SENDER_CHOICES, db_index=True)
    sender_label = models.CharField(max_length=120, blank=True, default='')
    message_type = models.CharField(max_length=10, choices=TYPE_CHOICES, default=TYPE_TEXT, db_index=True)
    content = models.TextField(blank=True, default='')
    content_masked = models.BooleanField(default=False, db_index=True)
    moderation_note = models.CharField(max_length=255, blank=True, default='')
    media_file = models.FileField(upload_to='ghostChatMedia', blank=True, null=True, max_length=255)
    media_name = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_by_user = models.BooleanField(default=False)
    read_by_agent = models.BooleanField(default=False)
    deleted_for_everyone = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by_agent = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['thread', 'created_at'], name='gmsg_thread_created_idx'),
            models.Index(fields=['thread', 'deleted_for_everyone', 'created_at'], name='gmsg_thread_delcrt_idx'),
            models.Index(fields=['thread', 'sender_role', 'read_by_agent'], name='gmsg_thread_ragent_idx'),
            models.Index(fields=['thread', 'sender_role', 'read_by_user'], name='gmsg_thread_ruser_idx'),
        ]

    def __str__(self):
        return f'ghost-message:{self.thread_id}:{self.sender_role}:{self.id}'


class ModerationEvent(models.Model):
    CONTEXT_COMMUNITY = 'community'
    CONTEXT_PRIVATE_CHAT = 'private_chat'
    CONTEXT_CHOICES = [
        (CONTEXT_COMMUNITY, 'Community'),
        (CONTEXT_PRIVATE_CHAT, 'Private Chat')
    ]

    ACTION_MASKED = 'masked'
    ACTION_BLOCKED = 'blocked'
    ACTION_WARNED = 'warned'
    ACTION_CHOICES = [
        (ACTION_MASKED, 'Masked'),
        (ACTION_BLOCKED, 'Blocked'),
        (ACTION_WARNED, 'Warned')
    ]

    user = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='moderation_events',
        db_index=True
    )
    context = models.CharField(max_length=20, choices=CONTEXT_CHOICES, db_index=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, db_index=True)
    reason = models.CharField(max_length=255)
    channel_ref = models.CharField(max_length=120, blank=True, default='')
    original_excerpt = models.TextField(blank=True, default='')
    sanitized_excerpt = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['context', 'created_at'], name='mod_context_created_idx'),
            models.Index(fields=['user', 'created_at'], name='mod_user_created_idx'),
        ]

    def __str__(self):
        return f'moderation-event:{self.context}:{self.action}:{self.id}'


class Announcement(models.Model):
    TYPE_GLOBAL = 'GLOBAL'
    TYPE_PRIVATE = 'PRIVATE'
    TYPE_CHOICES = [
        (TYPE_GLOBAL, 'Global'),
        (TYPE_PRIVATE, 'Private')
    ]

    type = models.CharField(max_length=10, choices=TYPE_CHOICES, db_index=True)
    target_user = models.ForeignKey(
        CustomUser,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='targeted_announcements',
        db_index=True
    )
    title = models.CharField(max_length=180)
    description = models.TextField()
    cta_text = models.CharField(max_length=80)
    priority_label = models.CharField(max_length=32, default='IMPORTANT', blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_announcements'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', 'type', 'created_at'], name='ann_active_type_created_idx'),
            models.Index(fields=['is_active', 'target_user', 'created_at'], name='ann_active_user_created_idx')
        ]

    def __str__(self):
        return f'announcement:{self.id}:{self.type}:{self.target_user_id or "all"}'


class GlobalPaymentConfig(models.Model):
    qr_image = models.FileField(upload_to='globalPaymentQr', max_length=255, blank=True, null=True)
    account_holder_name = models.CharField(max_length=120, blank=True, default='')
    bank_name = models.CharField(max_length=120, blank=True, default='')
    account_number = models.CharField(max_length=80, blank=True, default='')
    ifsc = models.CharField(max_length=20, blank=True, default='')
    branch = models.CharField(max_length=120, blank=True, default='')
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_global_payment_configs'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['is_active', 'expires_at'], name='gp_active_exp_idx'),
            models.Index(fields=['created_at'], name='gp_created_idx')
        ]

    def __str__(self):
        return f'global-payment:{self.id}:{self.account_holder_name}:{self.expires_at.isoformat()}'


class PaymentConfigTemplate(models.Model):
    qr_image = models.FileField(upload_to='paymentTemplates', max_length=255, blank=True, null=True)
    account_holder_name = models.CharField(max_length=120, blank=True, default='')
    bank_name = models.CharField(max_length=120, blank=True, default='')
    account_number = models.CharField(max_length=80, blank=True, default='')
    ifsc = models.CharField(max_length=20, blank=True, default='')
    branch = models.CharField(max_length=120, blank=True, default='')
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_payment_templates'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['created_at'], name='pt_created_idx')
        ]

    def __str__(self):
        return f'payment-template:{self.id}:{self.created_at.isoformat()}'


class AgreementQuestion(models.Model):
    question_id = models.PositiveSmallIntegerField(
        unique=True,
        db_index=True,
        validators=[MinValueValidator(1), MaxValueValidator(20)]
    )
    description = models.TextField()
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['question_id']
        indexes = [
            models.Index(fields=['is_active', 'question_id'], name='agrq_active_qid_idx'),
        ]

    def __str__(self):
        return f'agreement-question:{self.question_id}'


class AgreementAnswer(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='agreement_answers', db_index=True)
    question = models.ForeignKey(AgreementQuestion, on_delete=models.CASCADE, related_name='answers', db_index=True)
    answer = models.BooleanField()
    answered_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['question__question_id']
        constraints = [
            models.UniqueConstraint(fields=['user', 'question'], name='unique_user_agreement_answer')
        ]
        indexes = [
            models.Index(fields=['user', 'question'], name='agra_user_q_idx'),
            models.Index(fields=['user', 'answered_at'], name='agra_user_ansat_idx')
        ]

    def __str__(self):
        return f'agreement-answer:user={self.user_id}:q={self.question_id}'


class PaymentTransaction(models.Model):
    STATUS_PENDING = 'pending'
    STATUS_VERIFIED = 'verified'
    STATUS_REJECTED = 'rejected'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_VERIFIED, 'Verified'),
        (STATUS_REJECTED, 'Rejected')
    ]

    SCOPE_GLOBAL = 'global'
    SCOPE_USER = 'user'
    SCOPE_CHOICES = [
        (SCOPE_GLOBAL, 'Global'),
        (SCOPE_USER, 'User')
    ]

    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='payment_transactions', db_index=True)
    transaction_id = models.CharField(max_length=120, db_index=True)
    proof_image = models.FileField(upload_to='paymentProofs', max_length=255)
    amount_inr = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_set_id = models.CharField(max_length=80, blank=True, default='')
    payment_scope = models.CharField(max_length=12, choices=SCOPE_CHOICES, blank=True, default='')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING, db_index=True)
    reviewed_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_payment_transactions'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'transaction_id'], name='uniq_user_txn_id')
        ]
        indexes = [
            models.Index(fields=['status', 'created_at'], name='ptxn_status_created_idx'),
            models.Index(fields=['user', 'created_at'], name='ptxn_user_created_idx')
        ]

    def __str__(self):
        return f'payment-transaction:{self.id}:{self.transaction_id}:{self.status}'


class TestimonialVideoAsset(models.Model):
    slug = models.CharField(max_length=80, unique=True, db_index=True)
    title = models.CharField(max_length=120)
    quote = models.CharField(max_length=320, blank=True, default='')
    source_file_name = models.CharField(max_length=255, blank=True, default='')
    uploaded_video = models.FileField(upload_to='video/masters', max_length=255, blank=True, null=True)
    duration_sec = models.PositiveIntegerField(default=0)
    priority = models.PositiveIntegerField(default=100, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    show_in_hero = models.BooleanField(default=False, db_index=True)
    created_by = models.ForeignKey(
        CustomUser,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_testimonial_video_assets'
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority', 'id']
        indexes = [
            models.Index(fields=['is_active', 'priority'], name='tva_active_priority_idx'),
            models.Index(fields=['show_in_hero', 'is_active', 'priority'], name='tva_hero_active_priority_idx')
        ]

    def __str__(self):
        return f'testimonial-video:{self.slug}:{self.is_active}'
