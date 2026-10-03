import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '../components/ConfirmDialog.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Icon from '../components/Icon.jsx';
import ServiceTile from '../components/ServiceTile.jsx';
import StatusLabel from '../components/StatusLabel.jsx';
import { useToast } from '../components/Toast.jsx';
import { findService, queueOf } from '../queueLogic.js';
import { useQueues } from '../QueueContext.jsx';
import { useFocusAfterRender } from '../useFocusAfterRender.js';
import { fmtTime, hashTint, initials, pad, people } from '../utils/format.js';

export default function WaitingLists() {
  const { serviceId } = useParams();
  const { state, serveNext, move, moveTo, removeVisitor } = useQueues();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const focusLater = useFocusAfterRender();
  const [draggedId, setDraggedId] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [servingVisitor, setServingVisitor] = useState(null);
  const [completion, setCompletion] = useState({ outcome: 'completed', problem: '', notes: '' });
  const serveDialogRef = useRef(null);

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

  useEffect(() => {
    if (!servingVisitor) return;
    serveDialogRef.current?.showModal();
  }, [servingVisitor]);

  function handleServeSubmit(event) {
    event.preventDefault();
    serveDialogRef.current?.close();
    toast(serveNext(service.id, completion));
    setServingVisitor(null);
    setCompletion({ outcome: 'completed', problem: '', notes: '' });
    focusLater(line.length > 1 ? 'serve-next' : 'page-title');
  }

  function handleServeCancel() {
    serveDialogRef.current?.close();
    setServingVisitor(null);
    setCompletion({ outcome: 'completed', problem: '', notes: '' });
  }

  // Keep focus on the moved row; at the top or bottom, switch to the other arrow.
  function handleMove(visitor, index, direction) {
    move(service.id, visitor.id, direction);
    const to = index + direction;
    const atEdge = (direction < 0 && to === 0) || (direction > 0 && to === line.length - 1);
    const sameArrow = direction < 0 ? 'up' : 'down';
    const otherArrow = direction < 0 ? 'down' : 'up';
    focusLater(`${atEdge ? otherArrow : sameArrow}-${visitor.id}`);
  }

  function handleDrop() {
    if (!draggedId) return;
    const from = line.findIndex((visitor) => visitor.id === draggedId);
    if (dropIndex !== null && dropIndex !== from) moveTo(service.id, draggedId, dropIndex);
    setDraggedId(null);
    setDropIndex(null);
  }

  function handleDragEnd() {
    setDraggedId(null);
    setDropIndex(null);
  }

  const previewLine = draggedId && dropIndex !== null
    ? (() => {
        const next = [...line];
        const from = next.findIndex((visitor) => visitor.id === draggedId);
        if (from < 0 || from === dropIndex) return next;
        const [visitor] = next.splice(from, 1);
        next.splice(dropIndex, 0, visitor);
        return next;
      })()
    : line;

  async function handleRemove(visitor, index) {
    const ok = await confirm({
      title: `Remove ${visitor.name}?`,
      body: `${visitor.name} (${visitor.id}) loses their place in ${service.name}. If they rejoin, they start at the end of the line.`,
      confirmLabel: 'Remove visitor',
      danger: true,
    });
    if (!ok) return;
    const next = line[index + 1] ?? line[index - 1];
    toast(removeVisitor(service.id, visitor.id));
    focusLater(next ? `remove-${next.id}` : 'page-title');
  }

  return (
    <>
      {heading}
      <div className="qtabs" role="group" aria-label="Choose a service">
        {state.services.map((s) => (
          <button
            key={s.id}
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
            <StatusLabel status={service.open ? 'open' : 'closed'} />
            <span>{people(line.length)} waiting</span>
            <span>{service.duration} min per visit</span>
          </p>
        </div>
        <button type="button" className="btn btn-primary" id="serve-next" onClick={() => setServingVisitor(line[0])} disabled={!line.length}>
          <Icon name="circle-check" />
          Serve next{line.length ? ` · ${line[0].id}` : ''}
        </button>
      </div>

      <dialog ref={serveDialogRef} onCancel={handleServeCancel}>
        {servingVisitor && (
          <form className="dlg-inner serve-form" onSubmit={handleServeSubmit}>
            <h2>Complete visit</h2>
            <p>{servingVisitor.name} · <span className="mono">{servingVisitor.id}</span></p>
            <label htmlFor="visit-problem">Problem</label>
            <textarea
              id="visit-problem"
              required
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
              <option value="follow-up">Follow-up needed</option>
            </select>
            <label htmlFor="visit-notes">Notes <span className="muted">(optional)</span></label>
            <textarea
              id="visit-notes"
              value={completion.notes}
              onChange={(event) => setCompletion({ ...completion, notes: event.target.value })}
              placeholder="Add a brief outcome or follow-up note"
            />
            <div className="dlg-actions">
              <button type="button" className="btn btn-secondary" onClick={handleServeCancel}>Cancel</button>
              <button type="submit" className="btn btn-primary">Complete visit</button>
            </div>
          </form>
        )}
      </dialog>

      {line.length ? (
        <ol className="qlist" aria-label={`${service.name} waiting list`}>
          {previewLine.map((v, i) => (
            <li
              key={v.id}
              className={`qrow ${i === 0 ? 'is-next' : ''} ${v.email ? 'is-you' : ''} ${draggedId === v.id ? 'is-dragging' : ''}`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', v.id);
                setDraggedId(v.id);
              }}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => {
                event.preventDefault();
                if (v.id === draggedId) return;
                const from = line.findIndex((visitor) => visitor.id === draggedId);
                const target = line.findIndex((visitor) => visitor.id === v.id);
                const beforeTarget = event.clientY < event.currentTarget.getBoundingClientRect().top + event.currentTarget.offsetHeight / 2;
                const rawIndex = target + (beforeTarget ? 0 : 1);
                const destination = rawIndex > from ? rawIndex - 1 : rawIndex;
                if (destination !== from) setDropIndex(destination);
              }}
              onDrop={handleDrop}
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
                {v.email && <span className="tag tag-you">Signed-in user</span>}
                <div className="qmeta">
                  <span className="mono">{v.id}</span> · joined {fmtTime(v.joinedAt)} · waits {i * service.duration} min
                </div>
              </div>
              <div className="qactions">
                <button
                  type="button"
                  className="icon-btn"
                  id={`up-${v.id}`}
                  aria-label={`Move ${v.name} up`}
                  disabled={i === 0}
                  onClick={() => handleMove(v, i, -1)}
                >
                  <Icon name="chevron-up" />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  id={`down-${v.id}`}
                  aria-label={`Move ${v.name} down`}
                  disabled={i === line.length - 1}
                  onClick={() => handleMove(v, i, 1)}
                >
                  <Icon name="chevron-down" />
                </button>
                <button
                  type="button"
                  className="icon-btn danger"
                  id={`remove-${v.id}`}
                  aria-label={`Remove ${v.name}`}
                  onClick={() => handleRemove(v, i)}
                >
                  <Icon name="x" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState
          icon="users"
          title="Nobody is waiting"
          body={service.open ? 'New visitors appear here as soon as they join.' : 'This queue is closed, so nobody can join until you open it.'}
        />
      )}
    </>
  );
}
