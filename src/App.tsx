import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type MediaKind = "image" | "video";

type MediaAsset = {
  id: string;
  name: string;
  kind: MediaKind;
  dataUrl: string;
};

type Submission = {
  id: string;
  creatorName: string;
  description: string;
  createdAt: string;
  media: [MediaAsset, MediaAsset];
};

type Vote = {
  voterId: string;
  submissionId: string;
  createdAt: string;
};

type VotingEvent = {
  id: string;
  title: string;
  subtitle: string;
  startsAt: string;
  endsAt: string;
  submissions: Submission[];
  votes: Vote[];
};

type SubmissionResult = Submission & {
  voteCount: number;
  percentage: number;
};

const EVENT_STORAGE_KEY = "voteyourhero:event";
const VOTER_STORAGE_KEY = "voteyourhero:voter";
const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

function createId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${random}`;
}

function svgDataUrl(label: string, startColor: string, endColor: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 650">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop stop-color="${startColor}" />
          <stop offset="1" stop-color="${endColor}" />
        </linearGradient>
      </defs>
      <rect width="900" height="650" rx="48" fill="url(#g)" />
      <circle cx="730" cy="130" r="140" fill="rgba(255,255,255,0.18)" />
      <circle cx="145" cy="560" r="190" fill="rgba(255,255,255,0.12)" />
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
        font-family="Arial, sans-serif" font-size="58" font-weight="700" fill="white">
        ${label}
      </text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildDefaultEvent(): VotingEvent {
  const now = Date.now();

  return {
    id: "launch-event",
    title: "Vote Your Hero Challenge",
    subtitle:
      "Post two photos or videos with your story, then let the community vote once before results are announced.",
    startsAt: new Date(now).toISOString(),
    endsAt: new Date(now + 60 * 60 * 1000).toISOString(),
    submissions: [
      {
        id: "submission-sky",
        creatorName: "Aarav",
        description:
          "My local football coach keeps kids active after school and deserves the hero spotlight.",
        createdAt: new Date(now - 45 * 60 * 1000).toISOString(),
        media: [
          {
            id: "media-sky-1",
            name: "coach-photo.svg",
            kind: "image",
            dataUrl: svgDataUrl("Coach Hero", "#6c5ce7", "#00cec9"),
          },
          {
            id: "media-sky-2",
            name: "team-photo.svg",
            kind: "image",
            dataUrl: svgDataUrl("Team Spirit", "#0984e3", "#fd79a8"),
          },
        ],
      },
      {
        id: "submission-garden",
        creatorName: "Meera",
        description:
          "Our neighborhood gardener turned an empty lot into a safe green place for everyone.",
        createdAt: new Date(now - 30 * 60 * 1000).toISOString(),
        media: [
          {
            id: "media-garden-1",
            name: "garden-before.svg",
            kind: "image",
            dataUrl: svgDataUrl("Before", "#00b894", "#55efc4"),
          },
          {
            id: "media-garden-2",
            name: "garden-after.svg",
            kind: "image",
            dataUrl: svgDataUrl("After", "#2d3436", "#00cec9"),
          },
        ],
      },
    ],
    votes: [],
  };
}

function loadEvent() {
  const fallback = buildDefaultEvent();
  const saved = localStorage.getItem(EVENT_STORAGE_KEY);

  if (!saved) {
    return fallback;
  }

  try {
    return { ...fallback, ...JSON.parse(saved) } as VotingEvent;
  } catch {
    return fallback;
  }
}

function loadVoterId() {
  const saved = localStorage.getItem(VOTER_STORAGE_KEY);

  if (saved) {
    return saved;
  }

  const nextVoterId = createId("voter");
  localStorage.setItem(VOTER_STORAGE_KEY, nextVoterId);
  return nextVoterId;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTimeLeft(milliseconds: number) {
  if (milliseconds <= 0) {
    return "Voting closed";
  }

  const totalMinutes = Math.ceil(milliseconds / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m left`;
  }

  return `${hours}h ${minutes}m left`;
}

function getMediaKind(file: File): MediaKind | null {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  return null;
}

function fileToMediaAsset(file: File): Promise<MediaAsset> {
  const kind = getMediaKind(file);

  if (!kind) {
    return Promise.reject(new Error(`${file.name} must be an image or video.`));
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(
      new Error(`${file.name} is too large. Please use files under 3 MB each.`),
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error(`Could not read ${file.name}.`));
        return;
      }

      resolve({
        id: createId("media"),
        name: file.name,
        kind,
        dataUrl: reader.result,
      });
    };

    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function getResults(event: VotingEvent): SubmissionResult[] {
  const totalVotes = event.votes.length;

  return event.submissions
    .map((submission) => {
      const voteCount = event.votes.filter(
        (vote) => vote.submissionId === submission.id,
      ).length;

      return {
        ...submission,
        voteCount,
        percentage: totalVotes === 0 ? 0 : Math.round((voteCount / totalVotes) * 100),
      };
    })
    .sort((first, second) => {
      if (second.voteCount !== first.voteCount) {
        return second.voteCount - first.voteCount;
      }

      return first.createdAt.localeCompare(second.createdAt);
    });
}

function MediaPreview({ media }: { media: MediaAsset }) {
  if (media.kind === "video") {
    return (
      <video className="media-preview" controls muted playsInline>
        <source src={media.dataUrl} />
        Your browser does not support this video.
      </video>
    );
  }

  return <img className="media-preview" src={media.dataUrl} alt={media.name} />;
}

function App() {
  const [event, setEvent] = useState<VotingEvent>(() => loadEvent());
  const [voterId] = useState(() => loadVoterId());
  const [now, setNow] = useState(() => Date.now());
  const [creatorName, setCreatorName] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [formMessage, setFormMessage] = useState("");
  const [formError, setFormError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(event));
  }, [event]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const eventEndsAt = new Date(event.endsAt).getTime();
  const eventEnded = now >= eventEndsAt;
  const currentVote = event.votes.find((vote) => vote.voterId === voterId);
  const results = useMemo(() => getResults(event), [event]);
  const totalVotes = event.votes.length;
  const winner = eventEnded ? results[0] : undefined;

  function handleFilesChange(selectedFiles: FileList | null) {
    setFormMessage("");
    setFormError("");

    const nextFiles = Array.from(selectedFiles ?? []);
    setFiles(nextFiles);

    if (nextFiles.length !== 2) {
      setFormError("Please choose exactly two photos or videos.");
      return;
    }

    const unsupportedFile = nextFiles.find((file) => !getMediaKind(file));
    if (unsupportedFile) {
      setFormError(`${unsupportedFile.name} is not a photo or video.`);
      return;
    }

    const oversizedFile = nextFiles.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversizedFile) {
      setFormError(`${oversizedFile.name} is too large. Keep each file under 3 MB.`);
    }
  }

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setFormMessage("");
    setFormError("");

    if (eventEnded) {
      setFormError("This event has ended, so new posts are closed.");
      return;
    }

    if (!creatorName.trim()) {
      setFormError("Please add your name.");
      return;
    }

    if (description.trim().length < 12) {
      setFormError("Please add a description with at least 12 characters.");
      return;
    }

    if (files.length !== 2) {
      setFormError("Please choose exactly two photos or videos.");
      return;
    }

    try {
      const uploadedMedia = await Promise.all(files.map(fileToMediaAsset));
      const media = [uploadedMedia[0], uploadedMedia[1]] as [MediaAsset, MediaAsset];
      const submission: Submission = {
        id: createId("submission"),
        creatorName: creatorName.trim(),
        description: description.trim(),
        createdAt: new Date().toISOString(),
        media,
      };

      setEvent((currentEvent) => ({
        ...currentEvent,
        submissions: [submission, ...currentEvent.submissions],
      }));
      setCreatorName("");
      setDescription("");
      setFiles([]);
      setFormMessage("Your hero post is live. The community can vote for it now.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to upload media.");
    }
  }

  function castVote(submissionId: string) {
    if (eventEnded) {
      return;
    }

    setEvent((currentEvent) => {
      const alreadyVoted = currentEvent.votes.some((vote) => vote.voterId === voterId);

      if (alreadyVoted) {
        return currentEvent;
      }

      return {
        ...currentEvent,
        votes: [
          ...currentEvent.votes,
          {
            voterId,
            submissionId,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  function closeEventNow() {
    setEvent((currentEvent) => ({
      ...currentEvent,
      endsAt: new Date().toISOString(),
    }));
  }

  function extendEvent() {
    setEvent((currentEvent) => ({
      ...currentEvent,
      endsAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    }));
  }

  function resetDemo() {
    const freshEvent = buildDefaultEvent();
    localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(freshEvent));
    setEvent(freshEvent);
    setFormMessage("Demo event has been reset.");
    setFormError("");
  }

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">VoteYourHero</p>
          <h1>{event.title}</h1>
          <p>{event.subtitle}</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#submit">
              Post two media
            </a>
            <a className="button button-secondary" href="#entries">
              Vote now
            </a>
          </div>
        </div>

        <aside className="event-card" aria-label="Event status">
          <span className={`status-pill ${eventEnded ? "closed" : "open"}`}>
            {eventEnded ? "Results announced" : "Voting open"}
          </span>
          <h2>{formatTimeLeft(eventEndsAt - now)}</h2>
          <p>Results unlock at {formatDateTime(event.endsAt)}.</p>
          <div className="stats-grid">
            <div>
              <strong>{event.submissions.length}</strong>
              <span>Posts</span>
            </div>
            <div>
              <strong>{totalVotes}</strong>
              <span>Votes</span>
            </div>
            <div>
              <strong>{currentVote ? "Yes" : "No"}</strong>
              <span>Your vote</span>
            </div>
          </div>
        </aside>
      </section>

      <section className="content-grid">
        <article className="panel" id="submit">
          <div className="section-heading">
            <p className="eyebrow">Create post</p>
            <h2>Submit exactly two photos or videos</h2>
            <p>
              Add your name, a short description, and two media files. For this MVP,
              uploads are stored in this browser.
            </p>
          </div>

          <form className="submission-form" onSubmit={handleSubmit}>
            <label>
              Your name
              <input
                value={creatorName}
                onChange={(changeEvent) => setCreatorName(changeEvent.target.value)}
                placeholder="e.g. Vishal"
                disabled={eventEnded}
              />
            </label>

            <label>
              Hero description
              <textarea
                value={description}
                onChange={(changeEvent) => setDescription(changeEvent.target.value)}
                placeholder="Tell voters why this person, moment, or team should win."
                rows={5}
                disabled={eventEnded}
              />
            </label>

            <label>
              Two photos or videos
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={(changeEvent) => handleFilesChange(changeEvent.target.files)}
                disabled={eventEnded}
              />
            </label>
            <p className="helper-text">
              Selected: {files.length}/2. Each file must be an image or video under 3 MB.
            </p>

            {formError ? <p className="message error">{formError}</p> : null}
            {formMessage ? <p className="message success">{formMessage}</p> : null}

            <button className="button button-primary" type="submit" disabled={eventEnded}>
              Publish hero post
            </button>
          </form>
        </article>

        <article className="panel" id="results">
          <div className="section-heading">
            <p className="eyebrow">Announcement</p>
            <h2>{eventEnded ? "Final result" : "Results are locked"}</h2>
            <p>
              {eventEnded
                ? "Voting is closed and the leaderboard is visible to everyone."
                : "Vote counts stay hidden until the event ends, so every voter gets the same fair view."}
            </p>
          </div>

          {eventEnded && winner ? (
            <div className="winner-card">
              <span>Winner</span>
              <strong>{winner.creatorName}</strong>
              <p>{winner.description}</p>
              <small>
                {winner.voteCount} vote{winner.voteCount === 1 ? "" : "s"} ({winner.percentage}%)
              </small>
            </div>
          ) : (
            <div className="locked-card">
              <strong>{formatTimeLeft(eventEndsAt - now)}</strong>
              <span>Results publish at {formatDateTime(event.endsAt)}</span>
            </div>
          )}

          <div className="demo-controls">
            <button className="button button-secondary" type="button" onClick={closeEventNow}>
              End event now
            </button>
            <button className="button button-secondary" type="button" onClick={extendEvent}>
              Reopen for 1 hour
            </button>
            <button className="button button-ghost" type="button" onClick={resetDemo}>
              Reset demo
            </button>
          </div>
        </article>
      </section>

      <section className="entries-section" id="entries">
        <div className="section-heading">
          <p className="eyebrow">Community posts</p>
          <h2>Vote once for your favorite hero</h2>
          <p>
            Your browser gets one voter ID for this event:{" "}
            <code>{voterId.slice(0, 16)}...</code>
          </p>
        </div>

        <div className="entries-grid">
          {results.map((submission, index) => {
            const hasCurrentVote = currentVote?.submissionId === submission.id;
            const voteDisabled = eventEnded || Boolean(currentVote);

            return (
              <article className="submission-card" key={submission.id}>
                {eventEnded ? <span className="rank-badge">#{index + 1}</span> : null}
                <div className="media-grid">
                  {submission.media.map((media) => (
                    <MediaPreview key={media.id} media={media} />
                  ))}
                </div>

                <div className="submission-body">
                  <div>
                    <p className="submitted-by">Posted by {submission.creatorName}</p>
                    <h3>{submission.description}</h3>
                    <small>Submitted {formatDateTime(submission.createdAt)}</small>
                  </div>

                  {eventEnded ? (
                    <div className="result-bar" aria-label={`${submission.percentage}% of votes`}>
                      <span style={{ width: `${submission.percentage}%` }} />
                    </div>
                  ) : null}

                  <div className="vote-row">
                    {eventEnded ? (
                      <strong>
                        {submission.voteCount} vote{submission.voteCount === 1 ? "" : "s"} (
                        {submission.percentage}%)
                      </strong>
                    ) : (
                      <span>{currentVote ? "Your vote is locked." : "Results hidden."}</span>
                    )}
                    <button
                      className={`button ${hasCurrentVote ? "button-selected" : "button-primary"}`}
                      type="button"
                      onClick={() => castVote(submission.id)}
                      disabled={voteDisabled}
                    >
                      {hasCurrentVote ? "Voted" : "Vote"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="production-note">
        <h2>Production-ready path</h2>
        <p>
          This prototype enforces one vote in the browser. A real public app should add
          user accounts or verified phone/email login, object storage for media, and a
          backend database with a unique vote rule on event ID plus voter ID.
        </p>
      </section>
    </main>
  );
}

export default App;
