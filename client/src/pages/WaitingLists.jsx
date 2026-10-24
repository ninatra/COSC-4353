import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { useToast } from '../components/Toast.jsx';
import { findService, queueOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { DEMO_EMAIL } from '../mockData.js';
import { formatWait, fmtTime, hashTint, initials, pad, people } from '../utils/format.js';

export default function WaitingLists() {
  const { serviceId } = useParams();
  const { state, serveNext, reorderQueue, removeVisitor } = useQueues();
  const navigate = useNavigate();
  const toast = useToast();
  const [servingVisitor, setServingVisitor] = useState(null);
  const [removingVisitor, setRemovingVisitor] = useState(null);
  const [removalNotes, setRemovalNotes] = useState('');
  const removalDialogRef = useRef(null);
  useEffect(() => { if (removingVisitor) removalDialogRef.current?.showModal(); }, [removingVisitor]);
  const [completion, setCompletion] = useState({ outcome: 'completed', problem: '', notes: '' });
  const serveDialogRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [dragged, setDragged] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const dragOrder = useRef([]);
  useEffect(() => {
    if (servingVisitor) serveDialogRef.current?.showModal();
  }, [servingVisitor]);

  const service = findService(state, serviceId) ?? state.services[0];
  const heading = (
    <>
      <p className="eyebrow">Administrator</p>
      <h1 id="page-title" tabIndex={-1}>
        Waiting lists
      </h1>
    </>
  );
  if (!service) {
    return (
      <>
        {heading}
        <EmptyState title="No services" body="Create a service to start a waiting list." />
      </>
    );
  }

  const line = queueOf(state, service.id);

  async function moveVisitor(entryId, targetIndex, previousIds = line.map(v => v.entryId)) {
    if (saving || targetIndex < 0 || targetIndex >= previousIds.length) return;
    const ids = [...previousIds];
    const from = ids.indexOf(entryId);
    if (from < 0 || from === targetIndex) return;
    ids.splice(targetIndex, 0, ...ids.splice(from, 1));
    setSaving(true);
    try { toast(await reorderQueue(service.id, ids, previousIds)); }
    catch (error) { toast(error.message); }
    finally { setSaving(false); }
  }

  function handleRemove(visitor) {
    setRemovalNotes('');
    setRemovingVisitor(visitor);
  }
  function closeRemoval() {
    if (saving) return;
    removalDialogRef.current?.close();
    setRemovingVisitor(null);
  }
  async function submitRemoval(event) {
    event.preventDefault();
    setSaving(true);
    try {
      toast(await removeVisitor(service.id, removingVisitor.entryId, removalNotes));
      removalDialogRef.current?.close();
      setRemovingVisitor(null);
    } catch (error) { toast(error.message); }
    finally { setSaving(false); }
  }

  async function handleServeSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      toast(await serveNext(service.id, completion, servingVisitor.entryId));
      serveDialogRef.current?.close();
      setServingVisitor(null);
      setCompletion({ outcome: 'completed', problem: '', notes: '' });
    } catch (error) { toast(error.message); }
    finally { setSaving(false); }
  }

  function handleServeCancel() {
    serveDialogRef.current?.close();
    setServingVisitor(null);
    setCompletion({ outcome: 'completed', problem: '', notes: '' });
  }

  return (
    <>
      {heading}
      <div className="qtabs" role="group" aria-label="Choose a service">
        {state.services.map((s) => (
          <button
            key={s.id}
            disabled={saving || Boolean(dragged)}
            type="button"
            className="qtab"
            aria-pressed={s.id === service.id}
            onClick={() => navigate(`/admin/queues/${s.id}`)}
          >
            <ServiceTile service={s} />
            {s.name}
            <span className="c">{queueOf(state, s.id).length}</span>
          </button>
        ))}
      </div>

      <div className="q-head">
        <div>
          <h2>{service.name}</h2>
          <p className="meta">
            <StatusLabel status={service.isOpen ? 'open' : 'closed'} />
            <span>{people(line.length)} waiting</span>
            <span>{service.expectedDuration} min per visit</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary" id="serve-next" onClick={() => setServingVisitor(line[0])} disabled={!line.length || saving}>
          <Icon name="circle-check" />
          Serve next{line.length ? ` · ${line[0].id}` : ''}
        </button>
      </div>

      <dialog ref={removalDialogRef} onCancel={event => { event.preventDefault(); closeRemoval(); }}>
        {removingVisitor && <form className="dlg-inner serve-form" onSubmit={submitRemoval}>
          <h2>Remove student</h2>
          <p>{removingVisitor.name} · <span className="mono">{removingVisitor.id}</span></p>
          <p>{service.name}</p>
          <label htmlFor="removal-notes">Notes / reason (optional)</label>
          <textarea id="removal-notes" maxLength={500} value={removalNotes} onChange={event => setRemovalNotes(event.target.value)} placeholder="Add the reason for removal or any relevant details" />
          <p className="muted">This releases the student's place. They can join the queue again.</p>
          <div className="dlg-actions">
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={closeRemoval}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={saving}>Remove student</button>
          </div>
        </form>}
      </dialog>

      <dialog ref={serveDialogRef} onCancel={handleServeCancel}>
        {servingVisitor && (
          <form className="dlg-inner serve-form" onSubmit={handleServeSubmit}>
            <h2>Complete visit</h2>
            <p>{servingVisitor.name} · <span className="mono">{servingVisitor.id}</span></p>
            <label htmlFor="visit-problem">Issue (optional)</label>
            <textarea
              id="visit-problem"
              maxLength={500}
              value={completion.problem}
              onChange={(event) => setCompletion({ ...completion, problem: event.target.value })}
              placeholder="What did the student need help with?"
            />
            <label htmlFor="visit-outcome">Outcome</label>
            <select
              id="visit-outcome"
              value={completion.outcome}
              onChange={(event) => setCompletion({ ...completion, outcome: event.target.value })}
            >
              <option value="completed">Completed</option>
              <option value="referred">Referred elsewhere</option>
              <option value="unresolved">Unresolved</option>
              <option value="follow-up">Follow-up</option>
            </select>
            <label htmlFor="visit-notes">Notes <span className="muted">(optional)</span></label>
            <textarea
              id="visit-notes"
              maxLength={500}
              value={completion.notes}
              onChange={(event) => setCompletion({ ...completion, notes: event.target.value })}
              placeholder="Add a brief outcome or follow-up note"
            />
            <div className="dlg-actions">
              <button type="button" className="btn btn-secondary" onClick={handleServeCancel}>Cancel</button>
              <button type="submit" disabled={saving} className="btn btn-primary">Complete visit</button>
            </div>
          </form>
        )}
      </dialog>

      {line.length > 1 && <p className="muted">Drag visitors to reorder, or use the arrow buttons. New visitors join at the end after manual reordering.</p>}
      {line.length ? (
        <ol className="qlist" aria-label={`${service.name} waiting list`}>
          {line.map((v, i) => (
            <li
              key={v.id}
              className={`qrow ${i === 0 ? 'is-next' : ''} ${dragged === v.entryId ? 'is-dragging' : ''} ${dropTarget === v.entryId ? 'is-drop-target' : ''}`}
              draggable={!saving && !servingVisitor && !removingVisitor}
              onDragStart={(event) => {
                if (event.target.closest('button')) { event.preventDefault(); return; }
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', String(v.entryId));
                dragOrder.current = line.map(visitor => visitor.entryId);
                setDragged(v.entryId);
              }}
              onDragOver={(event) => {
                if (dragged === null || dragged === v.entryId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                setDropTarget(v.entryId);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged !== null) moveVisitor(dragged, dragOrder.current.indexOf(v.entryId), dragOrder.current);
                setDragged(null); setDropTarget(null);
              }}
              onDragEnd={() => { setDragged(null); setDropTarget(null); }}
            >
              <span className="qpos" aria-hidden="true">
                {pad(i + 1)}
              </span>
              <span className={`pav tint-${hashTint(v.name)}`} aria-hidden="true">
                {initials(v.name)}
              </span>
              <div>
                <span className="sr-only">Position {i + 1}: </span>
                <span className="qname">{v.name}</span>
                {i === 0 && <span className="tag tag-next">Next</span>}
                {v.email === DEMO_EMAIL && <span className="tag tag-you">Signed-in user</span>}
                <div className="qmeta">
                  <span className="mono">{v.id}</span> · joined {fmtTime(v.joinedAt)} · waits {formatWait(i * service.expectedDuration)}
                </div>
              </div>
              <div className="qactions">
                <button type="button" className="icon-btn" aria-label={`Move ${v.name} up`} disabled={saving || (Boolean(servingVisitor) || Boolean(removingVisitor)) || i === 0} onClick={() => moveVisitor(v.entryId, i - 1)}><Icon name="chevron-up" /></button>
                <button type="button" className="icon-btn" aria-label={`Move ${v.name} down`} disabled={saving || (Boolean(servingVisitor) || Boolean(removingVisitor)) || i === line.length - 1} onClick={() => moveVisitor(v.entryId, i + 1)}><Icon name="chevron-down" /></button>
                <button type="button" className="icon-btn danger" aria-label={`Remove ${v.name} from queue`} title="Remove student" disabled={saving || (Boolean(servingVisitor) || Boolean(removingVisitor))} onClick={() => handleRemove(v)}><Icon name="x" /></button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="users"
          title="Nobody is waiting"
          body={service.isOpen ? 'New visitors appear here as soon as they join.' : 'This queue is closed, so nobody can join until you open it.'}
        />
      )}
    </>
  );
}
