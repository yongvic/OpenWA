import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Megaphone,
  Smartphone,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { contactApi, messageApi, type BulkBatchStatus } from '../services/api';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useRole } from '../hooks/useRole';
import { useSessionsQuery, useTemplatesQuery } from '../hooks/queries';
import { PageHeader } from '../components/PageHeader';
import {
  chunkArray,
  estimateCampaignMinutes,
  isPersonalContactId,
  parseContactsFile,
  parsePhoneNumbers,
  resolvePhoneNumbers,
  type CampaignRecipient,
} from '../utils/campaignContacts';
import {
  buildBulkMessageItem,
  isMediaMessageType,
  isMessageStepValid,
  mediaAcceptForType,
  previewWithVariables,
  readFileAsBase64,
  templateToText,
  type CampaignMedia,
  type CampaignMessageType,
} from '../utils/campaignMessage';
import './Campaigns.css';

type Step = 1 | 2 | 3;
type ContactSource = 'paste' | 'file' | 'whatsapp';
type MediaSource = 'upload' | 'url';
type Phase = 'compose' | 'sending' | 'done';

const BULK_CHUNK_SIZE = 100;
const POLL_MS = 2000;

function contactLabel(contact: { name?: string; pushName?: string; number: string }) {
  return contact.name || contact.pushName || contact.number;
}

function mediaPreviewIcon(type: CampaignMessageType): string {
  if (type === 'image') return '🖼';
  if (type === 'video') return '🎬';
  if (type === 'document') return '📎';
  return '';
}

function uploadLabelKey(type: CampaignMessageType): 'uploadImage' | 'uploadVideo' | 'uploadDocument' {
  if (type === 'video') return 'uploadVideo';
  if (type === 'document') return 'uploadDocument';
  return 'uploadImage';
}

async function waitForBatch(sessionId: string, batchId: string): Promise<BulkBatchStatus> {
  for (;;) {
    const status = await messageApi.getBatchStatus(sessionId, batchId);
    if (['completed', 'cancelled', 'failed'].includes(status.status)) {
      return status;
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

export function Campaigns() {
  const { t } = useTranslation();
  useDocumentTitle(t('campaigns.title'));
  const { canWrite } = useRole();
  const { data: allSessions = [], isLoading: loadingSessions } = useSessionsQuery();
  const readySessions = allSessions.filter(session => session.status === 'ready');

  const [step, setStep] = useState<Step>(1);
  const [sessionId, setSessionId] = useState('');
  const [source, setSource] = useState<ContactSource>('paste');
  const [pasteText, setPasteText] = useState('');
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [invalidNumbers, setInvalidNumbers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<CampaignMessageType>('text');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaFile, setMediaFile] = useState<CampaignMedia | null>(null);
  const [mediaFileName, setMediaFileName] = useState('');
  const [mediaSource, setMediaSource] = useState<MediaSource>('upload');
  const { data: templates = [] } = useTemplatesQuery(sessionId, !!sessionId);
  const [selectedWaIds, setSelectedWaIds] = useState<Set<string>>(new Set());
  const [waContacts, setWaContacts] = useState<CampaignRecipient[]>([]);
  const [loadingWaContacts, setLoadingWaContacts] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState({ done: 0, total: 0 });
  const [phase, setPhase] = useState<Phase>('compose');
  const [sendProgress, setSendProgress] = useState({ sent: 0, failed: 0, total: 0 });
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<'completed' | 'cancelled' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const cancelRequestedRef = useRef(false);

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const composedText = useMemo(() => {
    if (messageType === 'template' && selectedTemplate) {
      return templateToText(selectedTemplate);
    }
    return message;
  }, [message, messageType, selectedTemplate]);

  const previewText = useMemo(
    () => previewWithVariables(composedText.trim() || t('campaigns.preview.empty')),
    [composedText, t],
  );

  useEffect(() => {
    if (!sessionId && readySessions.length > 0) {
      setSessionId(readySessions[0].id);
    }
  }, [sessionId, readySessions]);

  useEffect(() => {
    setWaContacts([]);
    setSelectedWaIds(new Set());
    setRecipients([]);
    setInvalidNumbers([]);
    setPasteText('');
    setMessageType('text');
    setSelectedTemplateId('');
    setMediaUrl('');
    setMediaFile(null);
    setMediaFileName('');
  }, [sessionId]);

  useEffect(() => {
    if (templates.length > 0 && !selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [templates, selectedTemplateId]);

  const selectedCount = useMemo(() => {
    if (source === 'whatsapp') return selectedWaIds.size;
    return recipients.length;
  }, [source, selectedWaIds, recipients]);

  const estimatedMinutes = useMemo(
    () => estimateCampaignMinutes(selectedCount),
    [selectedCount],
  );

  const loadWhatsAppContacts = async () => {
    if (!sessionId) return;
    setLoadingWaContacts(true);
    setError(null);
    try {
      const contacts = await contactApi.list(sessionId, { limit: 1000 });
      const personal = contacts
        .filter(c => isPersonalContactId(c.id) && !c.isBlocked)
        .map(c => ({
          chatId: c.id,
          label: contactLabel(c),
        }));
      setWaContacts(personal);
      setSelectedWaIds(new Set(personal.map(c => c.chatId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaigns.errors.loadContacts'));
    } finally {
      setLoadingWaContacts(false);
    }
  };

  const validatePastedOrFileNumbers = async (numbers: string[]) => {
    if (!sessionId || numbers.length === 0) {
      setRecipients([]);
      setInvalidNumbers([]);
      return;
    }
    setValidating(true);
    setValidationProgress({ done: 0, total: numbers.length });
    setError(null);
    try {
      const result = await resolvePhoneNumbers(
        digits => contactApi.checkNumber(sessionId, digits),
        numbers,
        (done, total) => setValidationProgress({ done, total }),
      );
      setRecipients(result.valid);
      setInvalidNumbers(result.invalid);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaigns.errors.validate'));
    } finally {
      setValidating(false);
    }
  };

  const handlePasteBlur = () => {
    const numbers = parsePhoneNumbers(pasteText);
    void validatePastedOrFileNumbers(numbers);
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const numbers = await parseContactsFile(file);
      setPasteText(numbers.join('\n'));
      await validatePastedOrFileNumbers(numbers);
    } catch {
      setError(t('campaigns.errors.fileRead'));
    } finally {
      event.target.value = '';
    }
  };

  const handleMediaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const media = await readFileAsBase64(file);
      setMediaFile(media);
      setMediaFileName(file.name);
      setMediaUrl('');
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        setError(t('campaigns.errors.fileTooLarge'));
      } else {
        setError(t('campaigns.errors.fileRead'));
      }
    } finally {
      event.target.value = '';
    }
  };

  const switchMessageType = (type: CampaignMessageType) => {
    setMessageType(type);
    setMediaUrl('');
    setMediaFile(null);
    setMediaFileName('');
    setMediaSource('upload');
    setError(null);
  };

  const switchMediaSource = (next: MediaSource) => {
    setMediaSource(next);
    setMediaUrl('');
    setMediaFile(null);
    setMediaFileName('');
    setError(null);
  };

  const toggleWaContact = (chatId: string) => {
    setSelectedWaIds(prev => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const toggleAllWaContacts = () => {
    if (selectedWaIds.size === waContacts.length) {
      setSelectedWaIds(new Set());
    } else {
      setSelectedWaIds(new Set(waContacts.map(c => c.chatId)));
    }
  };

  const getActiveRecipients = useCallback((): CampaignRecipient[] => {
    if (source === 'whatsapp') {
      return waContacts.filter(c => selectedWaIds.has(c.chatId));
    }
    return recipients;
  }, [source, waContacts, selectedWaIds, recipients]);

  const canGoNextStep1 = sessionId && selectedCount > 0 && !validating;
  const canGoNextStep2 = isMessageStepValid(
    messageType,
    message,
    mediaFile ?? (mediaUrl.trim() ? { url: mediaUrl.trim() } : null),
    selectedTemplateId,
  );

  const resolveMedia = (): CampaignMedia | undefined => {
    if (mediaFile) return mediaFile;
    if (mediaUrl.trim()) return { url: mediaUrl.trim() };
    return undefined;
  };

  const runCampaign = async () => {
    const targets = getActiveRecipients();
    if (!sessionId || targets.length === 0 || !canGoNextStep2) return;

    const textPayload =
      messageType === 'template' && selectedTemplate ? templateToText(selectedTemplate) : message.trim();
    const media = isMediaMessageType(messageType) ? resolveMedia() : undefined;
    const bulkType = messageType === 'template' ? 'text' : messageType;

    setPhase('sending');
    setError(null);
    cancelRequestedRef.current = false;
    setSendProgress({ sent: 0, failed: 0, total: targets.length });
    setFinalStatus(null);

    const chunks = chunkArray(targets, BULK_CHUNK_SIZE);
    let sent = 0;
    let failed = 0;

    try {
      for (const chunk of chunks) {
        if (cancelRequestedRef.current) break;

        const response = await messageApi.sendBulk(sessionId, {
          messages: chunk.map(recipient =>
            buildBulkMessageItem(recipient, bulkType, { text: textPayload, media }),
          ),
          options: {
            delayBetweenMessages: 3000,
            randomizeDelay: true,
            stopOnError: false,
          },
        });

        setCurrentBatchId(response.batchId);
        const status = await waitForBatch(sessionId, response.batchId);

        if (cancelRequestedRef.current || status.status === 'cancelled') {
          sent += status.progress.sent;
          failed += status.progress.failed;
          setSendProgress({ sent, failed, total: targets.length });
          setFinalStatus('cancelled');
          setPhase('done');
          return;
        }

        sent += status.progress.sent;
        failed += status.progress.failed;
        setSendProgress({ sent, failed, total: targets.length });
      }

      setFinalStatus(failed > 0 && sent === 0 ? 'failed' : 'completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('campaigns.errors.send'));
      setFinalStatus('failed');
    } finally {
      setCurrentBatchId(null);
      setPhase('done');
    }
  };

  const handleCancelSend = async () => {
    cancelRequestedRef.current = true;
    if (sessionId && currentBatchId) {
      try {
        await messageApi.cancelBatch(sessionId, currentBatchId);
      } catch {
        /* polling loop will observe cancelled status */
      }
    }
  };

  const resetCampaign = () => {
    setStep(1);
    setPhase('compose');
    setMessage('');
    setMessageType('text');
    setSelectedTemplateId('');
    setMediaUrl('');
    setMediaFile(null);
    setMediaFileName('');
    setMediaSource('upload');
    setRecipients([]);
    setInvalidNumbers([]);
    setPasteText('');
    setWaContacts([]);
    setSelectedWaIds(new Set());
    setSendProgress({ sent: 0, failed: 0, total: 0 });
    setFinalStatus(null);
    setError(null);
  };

  if (loadingSessions) {
    return (
      <div className="campaigns-page product-page campaigns-loading">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (readySessions.length === 0) {
    return (
      <div className="campaigns-page product-page">
        <PageHeader title={t('campaigns.title')} subtitle={t('campaigns.subtitle')} />
        <div className="campaigns-empty">
          <Smartphone size={48} />
          <h2>{t('campaigns.noSessionTitle')}</h2>
          <p>{t('campaigns.noSessionDesc')}</p>
          <Link to="/sessions" className="btn-primary">
            {t('campaigns.goToSessions')}
          </Link>
        </div>
      </div>
    );
  }

  if (phase === 'sending' || phase === 'done') {
    const progressPct =
      sendProgress.total > 0
        ? Math.round(((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100)
        : 0;

    return (
      <div className="campaigns-page product-page">
        <PageHeader title={t('campaigns.title')} subtitle={t('campaigns.subtitle')} />
        <div className="campaigns-progress-card">
          {phase === 'sending' ? (
            <>
              <Loader2 className="animate-spin campaigns-progress-icon" size={40} />
              <h2>{t('campaigns.sending.title')}</h2>
              <p>{t('campaigns.sending.hint', { minutes: estimatedMinutes })}</p>
            </>
          ) : finalStatus === 'completed' ? (
            <>
              <CheckCircle2 className="campaigns-progress-icon success" size={40} />
              <h2>{t('campaigns.done.successTitle')}</h2>
            </>
          ) : finalStatus === 'cancelled' ? (
            <>
              <AlertTriangle className="campaigns-progress-icon warning" size={40} />
              <h2>{t('campaigns.done.cancelledTitle')}</h2>
            </>
          ) : (
            <>
              <XCircle className="campaigns-progress-icon error" size={40} />
              <h2>{t('campaigns.done.failedTitle')}</h2>
            </>
          )}

          <div className="campaigns-progress-bar" aria-hidden="true">
            <div className="campaigns-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="campaigns-progress-stats">
            {t('campaigns.sending.stats', {
              sent: sendProgress.sent,
              failed: sendProgress.failed,
              total: sendProgress.total,
            })}
          </p>

          {error && <p className="campaigns-error">{error}</p>}

          <div className="campaigns-progress-actions">
            {phase === 'sending' && (
              <button type="button" className="btn-danger" onClick={() => void handleCancelSend()}>
                {t('campaigns.sending.cancel')}
              </button>
            )}
            {phase === 'done' && (
              <button type="button" className="btn-primary btn-lg" onClick={resetCampaign}>
                {t('campaigns.done.newCampaign')}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="campaigns-page product-page">
      <PageHeader title={t('campaigns.title')} subtitle={t('campaigns.subtitle')} />

      <div className="campaigns-steps" aria-label={t('campaigns.stepsLabel')}>
        {[1, 2, 3].map(n => (
          <div key={n} className={`campaigns-step ${step === n ? 'active' : ''} ${step > n ? 'done' : ''}`}>
            <span className="campaigns-step-number">{n}</span>
            <span className="campaigns-step-label">{t(`campaigns.steps.${n}`)}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="campaigns-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="campaigns-card">
        {step === 1 && (
          <>
            <div className="form-group">
              <label htmlFor="campaign-session">{t('campaigns.fields.session')}</label>
              <select
                id="campaign-session"
                value={sessionId}
                onChange={e => setSessionId(e.target.value)}
              >
                {readySessions.map(session => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                    {session.phone ? ` (${session.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="campaigns-source-tabs">
              {(['paste', 'file', 'whatsapp'] as ContactSource[]).map(key => (
                <button
                  key={key}
                  type="button"
                  className={`campaigns-source-tab ${source === key ? 'active' : ''}`}
                  onClick={() => setSource(key)}
                >
                  {key === 'paste' && <Users size={16} />}
                  {key === 'file' && <FileUp size={16} />}
                  {key === 'whatsapp' && <Smartphone size={16} />}
                  {t(`campaigns.sources.${key}`)}
                </button>
              ))}
            </div>

            {source === 'paste' && (
              <div className="form-group">
                <label htmlFor="campaign-numbers">{t('campaigns.fields.numbers')}</label>
                <textarea
                  id="campaign-numbers"
                  rows={8}
                  placeholder={t('campaigns.fields.numbersPlaceholder')}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                  onBlur={handlePasteBlur}
                />
                <p className="form-hint">{t('campaigns.fields.numbersHint')}</p>
              </div>
            )}

            {source === 'file' && (
              <div className="campaigns-file-zone">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.tsv"
                  className="campaigns-file-input"
                  onChange={e => void handleFileChange(e)}
                />
                <Upload size={32} />
                <p>{t('campaigns.file.dropHint')}</p>
                <button type="button" className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                  {t('campaigns.file.choose')}
                </button>
              </div>
            )}

            {source === 'whatsapp' && (
              <div className="campaigns-wa-list">
                {waContacts.length === 0 ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void loadWhatsAppContacts()}
                    disabled={loadingWaContacts}
                  >
                    {loadingWaContacts ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> {t('campaigns.wa.loading')}
                      </>
                    ) : (
                      t('campaigns.wa.load')
                    )}
                  </button>
                ) : (
                  <>
                    <div className="campaigns-wa-toolbar">
                      <button type="button" className="btn-link" onClick={toggleAllWaContacts}>
                        {selectedWaIds.size === waContacts.length
                          ? t('campaigns.wa.deselectAll')
                          : t('campaigns.wa.selectAll')}
                      </button>
                      <span>{t('campaigns.wa.selected', { count: selectedWaIds.size, total: waContacts.length })}</span>
                    </div>
                    <ul className="campaigns-wa-contacts">
                      {waContacts.map(contact => (
                        <li key={contact.chatId}>
                          <label>
                            <input
                              type="checkbox"
                              checked={selectedWaIds.has(contact.chatId)}
                              onChange={() => toggleWaContact(contact.chatId)}
                            />
                            <span>{contact.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {validating && (
              <p className="campaigns-validating">
                <Loader2 className="animate-spin" size={16} />
                {t('campaigns.validating', {
                  done: validationProgress.done,
                  total: validationProgress.total,
                })}
              </p>
            )}

            {!validating && (recipients.length > 0 || invalidNumbers.length > 0) && source !== 'whatsapp' && (
              <div className="campaigns-summary-inline">
                <p className="success">
                  {t('campaigns.summary.valid', { count: recipients.length })}
                </p>
                {invalidNumbers.length > 0 && (
                  <p className="warning">
                    {t('campaigns.summary.invalid', { count: invalidNumbers.length })}
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="campaigns-source-tabs">
              {(['text', 'image', 'video', 'document', 'template'] as CampaignMessageType[]).map(key => (
                <button
                  key={key}
                  type="button"
                  className={`campaigns-source-tab ${messageType === key ? 'active' : ''}`}
                  onClick={() => switchMessageType(key)}
                >
                  {t(`campaigns.messageTypes.${key}`)}
                </button>
              ))}
            </div>

            {messageType === 'template' ? (
              <div className="form-group">
                <label htmlFor="campaign-template">{t('campaigns.fields.template')}</label>
                {templates.length === 0 ? (
                  <p className="form-hint">{t('campaigns.fields.noTemplates')}</p>
                ) : (
                  <select
                    id="campaign-template"
                    value={selectedTemplateId}
                    onChange={e => setSelectedTemplateId(e.target.value)}
                    disabled={!canWrite}
                  >
                    {templates.map(template => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : isMediaMessageType(messageType) ? (
              <>
                <div className="campaigns-media-mode">
                  <button
                    type="button"
                    className={`campaigns-source-tab ${mediaSource === 'upload' ? 'active' : ''}`}
                    onClick={() => switchMediaSource('upload')}
                  >
                    <Upload size={16} />
                    {t('campaigns.mediaSource.upload')}
                  </button>
                  <button
                    type="button"
                    className={`campaigns-source-tab ${mediaSource === 'url' ? 'active' : ''}`}
                    onClick={() => switchMediaSource('url')}
                  >
                    {t('campaigns.mediaSource.url')}
                  </button>
                </div>

                {mediaSource === 'url' ? (
                  <div className="form-group">
                    <label htmlFor="campaign-media-url">{t('campaigns.fields.mediaUrl')}</label>
                    <input
                      id="campaign-media-url"
                      type="url"
                      placeholder="https://..."
                      value={mediaUrl}
                      onChange={e => setMediaUrl(e.target.value)}
                      disabled={!canWrite}
                    />
                    <p className="form-hint">{t('campaigns.fields.mediaUrlOnlyHint')}</p>
                  </div>
                ) : (
                  <div className="campaigns-file-zone campaigns-media-upload">
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept={mediaAcceptForType(messageType)}
                      className="campaigns-file-input"
                      onChange={e => void handleMediaFileChange(e)}
                    />
                    <Upload size={28} />
                    <p>
                      {mediaFileName
                        ? t('campaigns.fields.fileSelected', { name: mediaFileName })
                        : t(`campaigns.fields.${uploadLabelKey(messageType)}`)}
                    </p>
                    <button type="button" className="btn-primary" onClick={() => mediaInputRef.current?.click()}>
                      {t('campaigns.file.choose')}
                    </button>
                    <p className="form-hint">{t('campaigns.fields.uploadOnlyHint')}</p>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="campaign-caption">{t('campaigns.fields.caption')}</label>
                  <textarea
                    id="campaign-caption"
                    rows={4}
                    placeholder={t('campaigns.fields.messagePlaceholder')}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    maxLength={1024}
                    disabled={!canWrite}
                  />
                </div>
              </>
            ) : (
              <div className="form-group">
                <label htmlFor="campaign-message">{t('campaigns.fields.message')}</label>
                <textarea
                  id="campaign-message"
                  rows={10}
                  placeholder={t('campaigns.fields.messagePlaceholder')}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  maxLength={4096}
                  disabled={!canWrite}
                />
                <p className="form-hint">{t('campaigns.fields.messageHint', { count: message.length })}</p>
                <p className="form-hint">{t('campaigns.fields.nameHint')}</p>
              </div>
            )}

            <div className="campaigns-preview">
              <h3>{t('campaigns.preview.title')}</h3>
              {(isMediaMessageType(messageType)) && (mediaFileName || mediaUrl) && (
                <p className="campaigns-preview-media">
                  {mediaPreviewIcon(messageType)} {mediaFileName || mediaUrl}
                </p>
              )}
              <div className="campaigns-preview-bubble">{previewText}</div>
            </div>
          </>
        )}

        {step === 3 && (
          <div className="campaigns-review">
            <div className="campaigns-review-row">
              <span>{t('campaigns.review.recipients')}</span>
              <strong>{selectedCount}</strong>
            </div>
            <div className="campaigns-review-row">
              <span>{t('campaigns.review.type')}</span>
              <strong>{t(`campaigns.messageTypes.${messageType}`)}</strong>
            </div>
            <div className="campaigns-review-row">
              <span>{t('campaigns.review.duration')}</span>
              <strong>{t('campaigns.review.durationValue', { minutes: estimatedMinutes })}</strong>
            </div>
            <div className="campaigns-review-message">
              <span>{t('campaigns.review.message')}</span>
              {(isMediaMessageType(messageType)) && (mediaFileName || mediaUrl) && (
                <p className="campaigns-preview-media">
                  {mediaPreviewIcon(messageType)} {mediaFileName || mediaUrl}
                </p>
              )}
              <div className="campaigns-preview-bubble">{previewText}</div>
            </div>
            <div className="campaigns-warning">
              <AlertTriangle size={18} />
              <p>{t('campaigns.review.warning')}</p>
            </div>
          </div>
        )}

        <div className="campaigns-nav">
          {step > 1 && (
            <button type="button" className="btn-secondary" onClick={() => setStep((step - 1) as Step)}>
              <ChevronLeft size={16} />
              {t('common.back')}
            </button>
          )}
          <div className="campaigns-nav-spacer" />
          {step < 3 && (
            <button
              type="button"
              className="btn-primary"
              disabled={(step === 1 && !canGoNextStep1) || (step === 2 && !canGoNextStep2)}
              onClick={() => setStep((step + 1) as Step)}
            >
              {t('common.next')}
              <ChevronRight size={16} />
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn-primary btn-lg campaigns-send-btn"
              disabled={!canWrite || selectedCount === 0 || !canGoNextStep2}
              onClick={() => void runCampaign()}
            >
              <Megaphone size={18} />
              {canWrite ? t('campaigns.review.send') : t('campaigns.viewOnly')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
