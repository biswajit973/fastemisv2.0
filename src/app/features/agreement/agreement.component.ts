import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApplicationService } from '../../core/services/application.service';
import { NotificationService } from '../../core/services/notification.service';
import { AgreementApiService } from '../../core/services/agreement-api.service';
import { AgreementAnswerChoice, AgreementQuestionItem } from '../../core/models/agreement.model';
import { ScreenshotBlockDirective } from '../../shared/directives/screenshot-block.directive';

@Component({
  selector: 'app-agreement',
  standalone: true,
  imports: [CommonModule],
  hostDirectives: [ScreenshotBlockDirective],
  template: `
    <div class="min-h-screen bg-surface-2 flex flex-col">
      <header class="bg-surface/90 backdrop-blur-xl border-b border-border shadow-[0_4px_20px_rgb(0,0,0,0.03)] p-4 sticky top-0 z-50 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="goBack()"
            class="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center hover:bg-surface-3 transition-standard text-secondary hover:text-primary border border-border">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <span class="font-extrabold text-primary tracking-tight">EMI Plan Agreement & Consent</span>
        </div>
        <div class="text-[10px] font-bold bg-success/15 border border-success/30 text-success px-2.5 py-1 rounded-full tracking-widest uppercase shadow-sm">SECURE</div>
      </header>

      <div class="bg-surface-3 p-3 flex items-start gap-3 border-b border-border">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" class="text-primary shrink-0 mt-0.5" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        <p class="text-xs text-secondary leading-tight">For security, screenshots and screen recording are disabled on this page.</p>
      </div>

      <main class="flex-1 p-4 md:p-8">
        <div class="max-w-4xl mx-auto w-full rounded-3xl border border-[#e8ddc7] bg-[#fffdf6] shadow-[0_8px_30px_rgb(0,0,0,0.04)] px-5 py-6 md:px-10 md:py-8 animate-slide-up">
        <div class="mb-8 border-b border-[#efe6d3] pb-5">
          <h1 class="text-3xl font-extrabold text-primary mb-2 tracking-tight">Digital Agreement</h1>
          <p class="text-[15px] font-medium text-secondary agreement-book-copy">Answer all questions, add your digital signature, and record a 1-minute consent video.</p>
        </div>

        <div *ngIf="loading()" class="flex justify-center py-16">
          <div class="w-10 h-10 border-4 border-surface-3 border-t-primary rounded-full animate-spin"></div>
        </div>

        <section *ngIf="!loading() && !agreementEnabled()" class="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p class="text-sm font-semibold text-warning mb-1">Agreement is currently disabled</p>
          <p class="text-xs text-secondary">Support team has not enabled agreement for your account yet. Please check later.</p>
        </section>

        <ng-container *ngIf="!loading() && agreementEnabled()">
          <section class="mb-4 p-4 rounded-xl bg-surface-2 border border-border">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="text-sm font-semibold text-primary">Agreement Progress</div>
              <div class="text-xs text-secondary">{{ answeredCount() }} / {{ questions().length }} answered</div>
            </div>
            <div class="mt-2 h-2 bg-surface-3 rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-all duration-300" [style.width]="progressPercentage() + '%'"></div>
            </div>
          </section>

          <section *ngIf="questions().length === 0" class="p-5 rounded-xl border border-border bg-surface mb-4">
            <p class="text-sm font-semibold text-primary mb-1">No agreement questions available</p>
            <p class="text-xs text-secondary">Support team has not published agreement questions yet. Please check again later.</p>
          </section>

          <section *ngIf="questions().length > 0" class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold text-primary">Agreement Clauses</h2>
              <button
                *ngIf="!isReadOnlyMode()"
                type="button"
                (click)="agreeAllPending()"
                class="px-3 py-1.5 rounded border border-border text-xs font-medium text-primary hover:bg-surface-2">
                Agree All Pending
              </button>
            </div>

            <div class="space-y-4">
              <section *ngFor="let q of questions(); trackBy: trackByQuestionId"
                class="p-4 md:p-5 rounded-xl border transition-standard bg-[#fffef9]"
                [ngClass]="isQuestionAnswered(q) ? 'border-primary bg-primary-light/5' : 'border-border bg-surface'">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="text-[11px] uppercase tracking-[0.12em] text-muted font-semibold mb-1">Clause {{ q.questionId }}</div>
                    <p class="text-sm md:text-base font-medium text-primary agreement-book-copy">{{ q.description }}</p>
                  </div>
                  <span *ngIf="q.readonly || isReadOnlyMode()" class="text-[11px] px-2 py-1 rounded-full bg-surface-3 text-secondary whitespace-nowrap">Readonly</span>
                </div>

                <div class="mt-4 grid grid-cols-2 gap-3">
                  <label
                    class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-standard"
                    [ngClass]="answerForQuestion(q) === 'yes'
                      ? 'border-primary bg-primary-light/10 text-primary'
                      : 'border-border text-secondary'"
                    [class.opacity-60]="q.readonly || isReadOnlyMode()">
                    <input
                      type="radio"
                      class="accent-primary"
                      [name]="'agreement-' + q.questionId"
                      [checked]="answerForQuestion(q) === 'yes'"
                      [disabled]="q.readonly || isReadOnlyMode()"
                      (change)="selectAnswer(q, 'yes')" />
                    <span>Yes</span>
                  </label>

                  <label
                    class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-standard"
                    [ngClass]="answerForQuestion(q) === 'no'
                      ? 'border-primary bg-primary-light/10 text-primary'
                      : 'border-border text-secondary'"
                    [class.opacity-60]="q.readonly || isReadOnlyMode()">
                    <input
                      type="radio"
                      class="accent-primary"
                      [name]="'agreement-' + q.questionId"
                      [checked]="answerForQuestion(q) === 'no'"
                      [disabled]="q.readonly || isReadOnlyMode()"
                      (change)="selectAnswer(q, 'no')" />
                    <span>No</span>
                  </label>
                </div>
              </section>
            </div>
          </section>

          <section class="mb-6 rounded-xl border border-border bg-surface p-4">
            <div class="flex items-center justify-between gap-2 mb-3">
              <h2 class="text-base font-semibold text-primary">Digital Signature</h2>
              <button
                *ngIf="!isReadOnlyMode()"
                type="button"
                (click)="clearSignature()"
                class="px-3 py-1.5 rounded border border-border text-xs font-medium text-secondary hover:text-primary">
                Clear
              </button>
            </div>

            <p class="text-xs text-secondary mb-2">Sign using mouse or touchscreen.</p>

            <div *ngIf="isReadOnlyMode() && !signaturePreviewUrl()" class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-secondary">
              Signature not available.
            </div>

            <div *ngIf="!isReadOnlyMode()" class="rounded-lg border border-border bg-surface-2 overflow-hidden">
              <canvas
                #signatureCanvas
                class="block w-full h-[180px] touch-none"
                (pointerdown)="startSignatureDraw($event)"
                (pointermove)="moveSignatureDraw($event)"
                (pointerup)="endSignatureDraw($event)"
                (pointerleave)="endSignatureDraw($event)"
                (pointercancel)="endSignatureDraw($event)"
                (lostpointercapture)="endSignatureDraw($event)"
                (mousedown)="startSignatureMouseDraw($event)"
                (mousemove)="moveSignatureMouseDraw($event)"
                (mouseup)="endSignatureMouseDraw()"
                (mouseleave)="endSignatureMouseDraw()"
                (touchstart)="startSignatureTouchDraw($event)"
                (touchmove)="moveSignatureTouchDraw($event)"
                (touchend)="endSignatureTouchDraw()"
                (touchcancel)="endSignatureTouchDraw()"></canvas>
            </div>

            <div *ngIf="signaturePreviewUrl()" class="mt-3 rounded-lg border border-border bg-surface-2 p-2">
              <img [src]="signaturePreviewUrl()" alt="Signature preview" class="max-h-[220px] w-full object-contain rounded bg-white">
            </div>
          </section>

          <section class="mb-4 rounded-xl border border-border bg-surface p-4">
            <div class="flex items-center justify-between gap-2 mb-3">
              <h2 class="text-base font-semibold text-primary">Video Consent (Max 1 Minute)</h2>
              <span *ngIf="recording()" class="text-xs px-2 py-1 rounded-full bg-error/10 text-error">
                Recording {{ recordingSeconds() }}s / 60s
              </span>
            </div>

            <p class="text-xs text-secondary mb-3">
              Open camera and say: "I, [your name], accept all agreements for FastEMIs."
            </p>

            <div *ngIf="!cameraSupported()" class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-secondary mb-3">
              Live recorder not supported on this browser. Use capture option below.
            </div>

            <div *ngIf="!isReadOnlyMode()" class="flex flex-wrap gap-2 mb-3">
              <button
                *ngIf="cameraSupported() && !cameraReady()"
                type="button"
                (click)="startCamera()"
                [disabled]="cameraOpening()"
                class="px-3 py-2 rounded border border-border text-sm text-primary hover:bg-surface-2 disabled:opacity-50">
                {{ cameraOpening() ? 'Opening camera...' : 'Open Camera' }}
              </button>
              <button
                *ngIf="cameraSupported() && cameraReady() && !recording()"
                type="button"
                (click)="startRecordingFromCamera()"
                class="px-3 py-2 rounded text-sm font-medium disabled:opacity-50"
                [ngClass]="'bg-primary text-white'">
                Start Recording
              </button>
              <button
                *ngIf="cameraSupported() && cameraReady() && recording()"
                type="button"
                (click)="stopAndSaveRecording()"
                class="px-3 py-2 rounded text-sm font-medium bg-error text-white">
                Stop & Save
              </button>
              <button
                *ngIf="cameraReady() && !recording()"
                type="button"
                (click)="stopCamera()"
                class="px-3 py-2 rounded border border-border text-sm text-secondary hover:text-primary">
                Close Camera
              </button>
              <button
                *ngIf="consentVideoPreviewUrl() && !recording()"
                type="button"
                (click)="retakeVideo()"
                class="px-3 py-2 rounded border border-border text-sm text-secondary hover:text-primary">
                Retake Video
              </button>
              <label class="px-3 py-2 rounded border border-border text-sm text-primary hover:bg-surface-2 cursor-pointer">
                Capture/Upload Video
                <input type="file" class="hidden" accept="video/*" capture="user" (change)="onVideoFileSelected($event)">
              </label>
            </div>

            <p *ngIf="recording()" class="mb-3 text-xs text-error font-medium">
              Recording started. Tap "Stop & Save" whenever done (even after a few seconds).
            </p>

            <p *ngIf="!recording() && consentVideoPreviewUrl() && !isReadOnlyMode()" class="mb-3 text-xs text-success font-medium">
              Video saved successfully. You can submit now or retake/upload another video.
            </p>

            <div *ngIf="cameraError()" class="mb-3 rounded-lg border border-error/40 bg-error/10 p-2 text-xs text-error">
              {{ cameraError() }}
            </div>

            <div *ngIf="cameraReady() && !isReadOnlyMode()" class="rounded-lg border border-border bg-black overflow-hidden mb-3">
              <video #liveVideo autoplay muted playsinline class="w-full max-h-[280px] object-cover"></video>
            </div>

            <div *ngIf="consentVideoPreviewUrl()" class="rounded-lg border border-border bg-surface-2 p-2">
              <video [src]="consentVideoPreviewUrl()" controls class="w-full max-h-[320px] rounded bg-black"></video>
            </div>
          </section>

          <section *ngIf="agreementComplete()" class="rounded-xl border border-success/40 bg-success/10 p-4">
            <p class="text-sm font-semibold text-success mb-1">Agreement completed and locked</p>
            <p class="text-xs text-secondary">
              Submitted at {{ formatDateTime(agreementCompletedAt()) }}. All fields are readonly now.
            </p>
          </section>
        </ng-container>
        </div>
      </main>

      <footer class="sticky bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-border p-4 shadow-[0_-4px_10px_-4px_rgba(0,0,0,0.08)] z-40">
        <div class="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            class="h-11 px-4 rounded-lg border border-border text-primary bg-surface hover:bg-surface-2 transition-standard"
            (click)="goBack()">
            Back
          </button>

          <button
            *ngIf="agreementEnabled() && !agreementComplete()"
            type="button"
            class="h-11 px-5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-light transition-standard disabled:opacity-60 disabled:cursor-not-allowed"
            [disabled]="submitting() || !readyForFinalSubmit()"
            (click)="submitAgreement()">
            {{ submitting() ? 'Saving...' : 'Submit Agreement' }}
          </button>

          <button
            *ngIf="agreementComplete()"
            type="button"
            class="h-11 px-5 rounded-lg bg-primary text-white font-semibold hover:bg-primary-light transition-standard"
            (click)="goBack()">
            Back to Dashboard
          </button>
        </div>
      </footer>
    </div>
  `,
  styles: [`
      .agreement-book-copy {
        font-family: "Georgia", "Times New Roman", serif;
        line-height: 1.65;
      }
    `]
})
export class AgreementComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('signatureCanvas') signatureCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('liveVideo') liveVideoRef?: ElementRef<HTMLVideoElement>;

  questions = signal<AgreementQuestionItem[]>([]);
  editableAnswers = signal<Record<number, AgreementAnswerChoice>>({});

  loading = signal<boolean>(true);
  submitting = signal<boolean>(false);
  agreementEnabled = signal<boolean>(false);
  agreementComplete = signal<boolean>(false);
  agreementCompletedAt = signal<string | null>(null);

  signatureDirty = signal<boolean>(false);
  signaturePreviewDataUrl = signal<string>('');
  signatureUrl = signal<string>('');

  cameraOpening = signal<boolean>(false);
  cameraReady = signal<boolean>(false);
  recording = signal<boolean>(false);
  recordingSeconds = signal<number>(0);
  cameraError = signal<string>('');
  selectedVideoFile = signal<File | null>(null);
  selectedVideoUrl = signal<string>('');

  answeredCount = computed(() => this.questions().reduce((count, question) => (
    count + (this.isQuestionAnswered(question) ? 1 : 0)
  ), 0));

  private signatureContext: CanvasRenderingContext2D | null = null;
  private drawingSignature = false;
  private activePointerId: number | null = null;
  private signatureInitRetries = 0;
  private cameraStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recorderChunks: Blob[] = [];
  private recordTimer: number | null = null;

  constructor(
    private router: Router,
    private appService: ApplicationService,
    private notification: NotificationService,
    private agreementApi: AgreementApiService
  ) { }

  ngOnInit(): void {
    this.fetchAgreementState();
  }

  ngAfterViewInit(): void {
    this.setupSignatureCanvas();
    this.attachStreamToVideo();
  }

  ngOnDestroy(): void {
    this.stopRecording(false);
    this.stopCamera();
    this.clearSelectedVideoPreview();
  }

  fetchAgreementState(): void {
    this.loading.set(true);
    this.agreementApi.getUserAgreementState().subscribe((state) => {
      this.questions.set(state.questions);
      this.agreementEnabled.set(state.agreementEnabled);
      this.agreementComplete.set(state.agreementComplete);
      this.signatureUrl.set(state.signatureUrl || '');
      this.agreementCompletedAt.set(state.agreementCompletedAt || null);
      this.selectedVideoUrl.set(state.consentVideoUrl || '');
      this.selectedVideoFile.set(null);
      this.signatureDirty.set(false);
      this.signaturePreviewDataUrl.set('');

      const draft: Record<number, AgreementAnswerChoice> = {};
      for (const question of state.questions) {
        if (!question.readonly && (question.answer === 'yes' || question.answer === 'no')) {
          draft[question.questionId] = question.answer;
        }
      }
      this.editableAnswers.set(draft);
      this.loading.set(false);

      setTimeout(() => this.setupSignatureCanvas(), 0);
    });
  }

  trackByQuestionId(_: number, item: AgreementQuestionItem): number {
    return item.questionId;
  }

  isReadOnlyMode(): boolean {
    return this.agreementComplete();
  }

  answerForQuestion(question: AgreementQuestionItem): AgreementAnswerChoice | null {
    if (question.readonly || this.isReadOnlyMode()) {
      return question.answer;
    }
    return this.editableAnswers()[question.questionId] || null;
  }

  isQuestionAnswered(question: AgreementQuestionItem): boolean {
    const answer = this.answerForQuestion(question);
    return answer === 'yes' || answer === 'no';
  }

  selectAnswer(question: AgreementQuestionItem, answer: AgreementAnswerChoice): void {
    if (question.readonly || this.isReadOnlyMode()) {
      return;
    }
    this.editableAnswers.set({
      ...this.editableAnswers(),
      [question.questionId]: answer
    });
  }

  agreeAllPending(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    const next = { ...this.editableAnswers() };
    for (const question of this.questions()) {
      if (!question.readonly && !next[question.questionId]) {
        next[question.questionId] = 'yes';
      }
    }
    this.editableAnswers.set(next);
  }

  progressPercentage(): number {
    const total = this.questions().length;
    if (!total) return 0;
    return (this.answeredCount() / total) * 100;
  }

  signaturePreviewUrl(): string {
    return this.signaturePreviewDataUrl() || this.signatureUrl();
  }

  consentVideoPreviewUrl(): string {
    return this.selectedVideoUrl();
  }

  readyForFinalSubmit(): boolean {
    if (!this.agreementEnabled() || this.isReadOnlyMode()) {
      return false;
    }
    if (this.questions().length === 0 || this.answeredCount() !== this.questions().length) {
      return false;
    }
    if (!this.signaturePreviewUrl()) {
      return false;
    }
    if (!this.consentVideoPreviewUrl()) {
      return false;
    }
    return true;
  }

  cameraSupported(): boolean {
    return typeof window !== 'undefined'
      && typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
      && typeof MediaRecorder !== 'undefined';
  }

  clearSignature(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    if (!this.ensureSignatureCanvasReady()) {
      return;
    }
    const canvas = this.signatureCanvasRef?.nativeElement;
    const ctx = this.signatureContext;
    if (!canvas || !ctx) {
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureDirty.set(false);
    this.signaturePreviewDataUrl.set('');
  }

  startSignatureDraw(event: PointerEvent): void {
    if (!this.isPointerEventsSupported()) {
      return;
    }
    if (this.isReadOnlyMode()) {
      return;
    }
    if (!this.ensureSignatureCanvasReady()) {
      return;
    }
    const canvas = this.signatureCanvasRef?.nativeElement;
    const ctx = this.signatureContext;
    if (!canvas || !ctx) {
      return;
    }

    this.activePointerId = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    const { x, y } = this.pointerToCanvas(event, canvas);
    this.drawingSignature = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    this.signatureDirty.set(true);
    event.preventDefault();
  }

  moveSignatureDraw(event: PointerEvent): void {
    if (!this.isPointerEventsSupported()) {
      return;
    }
    if (!this.drawingSignature || this.isReadOnlyMode()) {
      return;
    }
    if (this.activePointerId !== null && event.pointerId !== this.activePointerId) {
      return;
    }
    if (!this.ensureSignatureCanvasReady()) {
      return;
    }
    const canvas = this.signatureCanvasRef?.nativeElement;
    const ctx = this.signatureContext;
    if (!canvas || !ctx) {
      return;
    }

    const { x, y } = this.pointerToCanvas(event, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    this.signatureDirty.set(true);
    event.preventDefault();
  }

  endSignatureDraw(event?: PointerEvent): void {
    if (!this.isPointerEventsSupported()) {
      return;
    }
    if (!this.drawingSignature) {
      this.releasePointerCaptureSafely(event);
      return;
    }
    this.drawingSignature = false;
    this.releasePointerCaptureSafely(event);
    this.activePointerId = null;
    this.signaturePreviewDataUrl.set(this.signatureCanvasRef?.nativeElement.toDataURL('image/png') || '');
  }

  startSignatureMouseDraw(event: MouseEvent): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    this.startDrawFromCoordinates(event.clientX, event.clientY);
    event.preventDefault();
  }

  moveSignatureMouseDraw(event: MouseEvent): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    this.moveDrawFromCoordinates(event.clientX, event.clientY);
    event.preventDefault();
  }

  endSignatureMouseDraw(): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    this.endDrawFromFallback();
  }

  startSignatureTouchDraw(event: TouchEvent): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    this.startDrawFromCoordinates(touch.clientX, touch.clientY);
    event.preventDefault();
  }

  moveSignatureTouchDraw(event: TouchEvent): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    const touch = event.touches?.[0];
    if (!touch) {
      return;
    }
    this.moveDrawFromCoordinates(touch.clientX, touch.clientY);
    event.preventDefault();
  }

  endSignatureTouchDraw(): void {
    if (this.isPointerEventsSupported()) {
      return;
    }
    this.endDrawFromFallback();
  }

  startCamera(): void {
    if (!this.cameraSupported() || this.cameraReady() || this.cameraOpening()) {
      return;
    }

    this.cameraError.set('');
    this.cameraOpening.set(true);
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((stream) => {
        this.cameraStream = stream;
        this.cameraReady.set(true);
        this.cameraOpening.set(false);
        setTimeout(() => this.attachStreamToVideo(), 0);
      })
      .catch(() => {
        this.cameraOpening.set(false);
        this.cameraError.set('Could not open camera. Please allow camera permission.');
      });
  }

  stopCamera(): void {
    if (this.recording()) {
      this.stopRecording(true);
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
    const video = this.liveVideoRef?.nativeElement;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
    this.cameraReady.set(false);
  }

  startRecordingFromCamera(): void {
    this.startRecording();
  }

  stopAndSaveRecording(): void {
    this.stopRecording(true);
  }

  retakeVideo(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    if (this.recording()) {
      this.stopRecording(true);
    }
    this.clearSelectedVideoPreview();
    this.selectedVideoFile.set(null);
    this.selectedVideoUrl.set('');
  }

  private startRecording(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    if (!this.cameraStream) {
      this.startCamera();
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      this.cameraError.set('Recording is not supported in this browser.');
      return;
    }

    this.cameraError.set('');
    this.recorderChunks = [];
    this.recordingSeconds.set(0);

    try {
      this.mediaRecorder = new MediaRecorder(this.cameraStream, { mimeType: 'video/webm' });
    } catch {
      this.mediaRecorder = new MediaRecorder(this.cameraStream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recorderChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recorderChunks, { type: this.mediaRecorder?.mimeType || 'video/webm' });
      const file = new File([blob], `agreement-consent-${Date.now()}.webm`, { type: blob.type || 'video/webm' });
      this.setSelectedVideo(file);
      this.recording.set(false);
      this.stopRecordTimer();
    };

    this.mediaRecorder.start(500);
    this.recording.set(true);
    this.startRecordTimer();
  }

  private startRecordTimer(): void {
    this.stopRecordTimer();
    this.recordTimer = window.setInterval(() => {
      const next = this.recordingSeconds() + 1;
      this.recordingSeconds.set(next);
      if (next >= 60) {
        this.stopRecording(true);
      }
    }, 1000);
  }

  private stopRecordTimer(): void {
    if (this.recordTimer !== null) {
      window.clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  }

  private stopRecording(stopRecorder: boolean): void {
    if (stopRecorder && this.mediaRecorder && this.recording()) {
      this.mediaRecorder.stop();
    }
    this.recording.set(false);
    this.stopRecordTimer();
  }

  onVideoFileSelected(event: Event): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.validateVideoDuration(file).then((isValid) => {
      if (!isValid) {
        this.notification.error('Video must be 1 minute or less.');
        return;
      }
      this.setSelectedVideo(file);
    }).catch(() => {
      this.notification.error('Could not validate video duration.');
    }).finally(() => {
      input.value = '';
    });
  }

  submitAgreement(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    if (!this.readyForFinalSubmit()) {
      this.notification.error('Please complete all questions, signature, and 1-minute consent video.');
      return;
    }

    const answers = this.questions().map((question) => ({
      questionId: question.questionId,
      answer: this.answerForQuestion(question) as AgreementAnswerChoice
    }));
    if (answers.some(item => item.answer !== 'yes' && item.answer !== 'no')) {
      this.notification.error('Please answer all agreement questions.');
      return;
    }

    this.submitting.set(true);
    const payload = new FormData();
    payload.append('answers_json', JSON.stringify(answers));

    const finishSubmit = (signatureBlob: Blob | null) => {
      if (signatureBlob) {
        payload.append('signature_image', signatureBlob, `signature-${Date.now()}.png`);
      }

      const videoFile = this.selectedVideoFile();
      if (videoFile) {
        payload.append('consent_video', videoFile, videoFile.name || `consent-${Date.now()}.webm`);
      }

      const wasComplete = this.agreementComplete();
      this.agreementApi.completeAgreement(payload).subscribe((state) => {
        this.submitting.set(false);
        if (!state || !state.agreementComplete) {
          this.notification.error('Could not complete agreement. Please retry.');
          return;
        }

        this.questions.set(state.questions);
        this.agreementEnabled.set(state.agreementEnabled);
        this.agreementComplete.set(state.agreementComplete);
        this.agreementCompletedAt.set(state.agreementCompletedAt || null);
        this.signatureUrl.set(state.signatureUrl || '');
        this.signatureDirty.set(false);
        this.signaturePreviewDataUrl.set('');
        this.selectedVideoFile.set(null);
        this.selectedVideoUrl.set(state.consentVideoUrl || '');
        this.stopRecording(false);
        this.stopCamera();

        if (!wasComplete) {
          this.appService.progressApplicationState();
        }

        this.notification.success('Agreement submitted successfully and locked.');
      });
    };

    if (this.signatureDirty()) {
      this.canvasToBlob().then((blob) => {
        if (!blob) {
          this.submitting.set(false);
          this.notification.error('Could not read signature. Please sign again.');
          return;
        }
        finishSubmit(blob);
      }).catch(() => {
        this.submitting.set(false);
        this.notification.error('Could not read signature. Please sign again.');
      });
      return;
    }

    finishSubmit(null);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  formatDateTime(value?: string | null): string {
    if (!value) return '-';
    return new Date(value).toLocaleString([], {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private setupSignatureCanvas(): void {
    const canvas = this.signatureCanvasRef?.nativeElement;
    if (!canvas || this.isReadOnlyMode()) {
      return;
    }
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      if (this.signatureInitRetries < 6) {
        this.signatureInitRetries += 1;
        window.setTimeout(() => this.setupSignatureCanvas(), 80);
      }
      return;
    }

    this.signatureInitRetries = 0;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#0A2540';
    this.signatureContext = ctx;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    const previousPreview = this.signaturePreviewDataUrl();
    this.setupSignatureCanvas();
    if (previousPreview && !this.signatureDirty()) {
      this.signaturePreviewDataUrl.set(previousPreview);
    }
  }

  private pointerToCanvas(event: PointerEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private canvasToBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = this.signatureCanvasRef?.nativeElement;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        try {
          const dataUrl = canvas.toDataURL('image/png', 0.95);
          resolve(this.dataUrlToBlob(dataUrl));
        } catch {
          resolve(null);
        }
      }, 'image/png', 0.95);
    });
  }

  private startDrawFromCoordinates(clientX: number, clientY: number): void {
    if (this.isReadOnlyMode()) {
      return;
    }
    if (!this.ensureSignatureCanvasReady()) {
      return;
    }
    const canvas = this.signatureCanvasRef?.nativeElement;
    const ctx = this.signatureContext;
    if (!canvas || !ctx) {
      return;
    }
    const { x, y } = this.coordsToCanvas(clientX, clientY, canvas);
    this.drawingSignature = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    this.signatureDirty.set(true);
  }

  private moveDrawFromCoordinates(clientX: number, clientY: number): void {
    if (!this.drawingSignature || this.isReadOnlyMode()) {
      return;
    }
    if (!this.ensureSignatureCanvasReady()) {
      return;
    }
    const canvas = this.signatureCanvasRef?.nativeElement;
    const ctx = this.signatureContext;
    if (!canvas || !ctx) {
      return;
    }
    const { x, y } = this.coordsToCanvas(clientX, clientY, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    this.signatureDirty.set(true);
  }

  private endDrawFromFallback(): void {
    if (!this.drawingSignature) {
      return;
    }
    this.drawingSignature = false;
    this.signaturePreviewDataUrl.set(this.signatureCanvasRef?.nativeElement.toDataURL('image/png') || '');
  }

  private ensureSignatureCanvasReady(): boolean {
    if (!this.signatureCanvasRef?.nativeElement) {
      return false;
    }
    if (!this.signatureContext) {
      this.setupSignatureCanvas();
    }
    return !!this.signatureContext;
  }

  private releasePointerCaptureSafely(event?: PointerEvent): void {
    const canvas = this.signatureCanvasRef?.nativeElement;
    if (!canvas || !event) {
      return;
    }
    try {
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    } catch {
      // no-op
    }
  }

  private isPointerEventsSupported(): boolean {
    return typeof window !== 'undefined' && 'PointerEvent' in window;
  }

  private coordsToCanvas(clientX: number, clientY: number, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  private dataUrlToBlob(dataUrl: string): Blob | null {
    const parts = dataUrl.split(',');
    if (parts.length !== 2) {
      return null;
    }
    const mimeMatch = parts[0].match(/data:(.*?);base64/);
    if (!mimeMatch) {
      return null;
    }
    try {
      const binary = atob(parts[1]);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new Blob([bytes], { type: mimeMatch[1] || 'image/png' });
    } catch {
      return null;
    }
  }

  private setSelectedVideo(file: File): void {
    this.clearSelectedVideoPreview();
    this.selectedVideoFile.set(file);
    this.selectedVideoUrl.set(URL.createObjectURL(file));
  }

  private clearSelectedVideoPreview(): void {
    const currentUrl = this.selectedVideoUrl();
    if (currentUrl && currentUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentUrl);
    }
  }

  private validateVideoDuration(file: File): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const duration = Number(video.duration || 0);
        URL.revokeObjectURL(url);
        resolve(duration > 0 && duration <= 60);
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('metadata_error'));
      };
      video.src = url;
    });
  }

  private attachStreamToVideo(): void {
    const video = this.liveVideoRef?.nativeElement;
    if (!video || !this.cameraStream) {
      return;
    }
    video.srcObject = this.cameraStream;
    video.play().catch(() => undefined);
  }
}
