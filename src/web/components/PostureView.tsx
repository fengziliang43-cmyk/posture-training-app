import { useEffect, useMemo, useState } from "react";
import { listPhotos, updatePhotoNote, uploadPhoto, type PhotoRecord } from "../api";
import { formatLocalDate } from "../../core/date";

const angles = [
  { value: "front", label: "正面" },
  { value: "side", label: "侧面" },
  { value: "back", label: "背面" }
] as const;

export function PostureView() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<(typeof angles)[number]["value"]>("front");
  const [compareMode, setCompareMode] = useState<"latest" | "month">("latest");
  const [compareBlend, setCompareBlend] = useState(50);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshPhotos();
  }, []);

  const groupedPhotos = useMemo(() => groupPhotosByDate(photos), [photos]);
  const anglePhotos = useMemo(
    () => selectComparisonPhotos(photos.filter((photo) => photo.angle === selectedAngle), compareMode),
    [photos, selectedAngle, compareMode]
  );

  async function refreshPhotos() {
    try {
      const response = await listPhotos();
      setPhotos(response.photos);
      setError(null);
    } catch {
      setError("体态照片加载失败。");
    }
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("photoFile") as HTMLInputElement | null;
    const dateInput = form.elements.namedItem("photoDate") as HTMLInputElement | null;
    const angleInput = form.elements.namedItem("angle") as HTMLSelectElement | null;
    const noteInput = form.elements.namedItem("note") as HTMLInputElement | null;

    if (!fileInput?.files?.[0] || !dateInput || !angleInput) {
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("photoDate", dateInput.value);
      formData.append("angle", angleInput.value);
      formData.append("note", noteInput?.value ?? "");
      formData.append("file", fileInput.files[0]);
      await uploadPhoto(formData);
      form.reset();
      await refreshPhotos();
    } catch {
      setError("照片上传失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(photoId: number) {
    setBusy(true);
    try {
      const note = noteDrafts[photoId] ?? photos.find((photo) => photo.id === photoId)?.note ?? "";
      await updatePhotoNote(photoId, note);
      await refreshPhotos();
    } catch {
      setError("备注保存失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">体态</p>
        <h2>每周三角度留档</h2>
        <p>支持本地上传正面、侧面、背面照片，并按同角度做对比。</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      <section className="card">
        <div className="mini-head">
          <div>
            <p className="eyebrow">对比视图</p>
            <h3 className="section-title">{angles.find((angle) => angle.value === selectedAngle)?.label} · 最新</h3>
          </div>
          <span className="date-pill">{compareBlend}%</span>
        </div>
        <div className="chip-row">
          <button
            type="button"
            className={compareMode === "latest" ? "secondary-button active-chip" : "secondary-button"}
            onClick={() => setCompareMode("latest")}
          >
            最新对比
          </button>
          <button
            type="button"
            className={compareMode === "month" ? "secondary-button active-chip" : "secondary-button"}
            onClick={() => setCompareMode("month")}
          >
            本月对比
          </button>
        </div>
        {anglePhotos.length >= 2 ? (
          <div className="compare-wrap">
            <div className="compare-stage">
              <img className="compare-image base" src={photoUrl(anglePhotos[0].id)} alt="" />
              <img
                className="compare-image overlay"
                src={photoUrl(anglePhotos[1].id)}
                alt=""
                style={{ opacity: compareBlend / 100 }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={compareBlend}
              onChange={(event) => setCompareBlend(Number(event.target.value))}
            />
            <p className="muted small">
              正在对比 {angles.find((angle) => angle.value === selectedAngle)?.label} 的
              {compareMode === "latest" ? "两张最新照片" : "本月第一张和最新照片"}。
            </p>
          </div>
        ) : (
          <p className="muted">先上传同角度两张照片，再开启滑块对比。</p>
        )}
      </section>

      <section className="card">
        <h3 className="section-title">角度选择</h3>
        <div className="chip-row">
          {angles.map((angle) => {
            const count = photos.filter((photo) => photo.angle === angle.value).length;
            return (
              <button
                key={angle.value}
                type="button"
                className={selectedAngle === angle.value ? "secondary-button active-chip" : "secondary-button"}
                onClick={() => setSelectedAngle(angle.value)}
              >
                {angle.label} {count}
              </button>
            );
          })}
        </div>
      </section>

      <details className="status-drawer">
        <summary>上传照片</summary>
        <form className="posture-form" onSubmit={handleUpload}>
          <label>
            拍摄日期
            <input name="photoDate" type="date" defaultValue={formatLocalDate()} />
          </label>

          <label>
            角度
            <select name="angle" defaultValue="front">
              {angles.map((angle) => (
                <option key={angle.value} value={angle.value}>
                  {angle.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            照片文件
            <input name="photoFile" type="file" accept="image/*" />
          </label>

          <label>
            备注
            <input name="note" maxLength={200} placeholder="比如：自然站姿、训练后、腰酸低" />
          </label>

          <button type="submit" disabled={busy}>
            {busy ? "上传中" : "上传照片"}
          </button>
        </form>
      </details>

      <section className="card">
        <h3 className="section-title">每周照片组</h3>
        <div className="photo-group-stack">
          {groupedPhotos.map((group) => (
            <article className="photo-group" key={group.date}>
              <div className="photo-group-head">
                <strong>{group.date}</strong>
                <span className="muted">{group.items.length} 张</span>
              </div>
              <div className="photo-grid">
                {group.items.map((photo) => (
                  <figure key={photo.id} className="photo-card">
                    <img src={photoUrl(photo.id)} alt={`${photo.photoDate} ${photo.angle}`} />
                    <figcaption>
                      {photo.angle} · {photo.createdAt.slice(11, 16)}
                    </figcaption>
                    {photo.note && <p className="muted small">{photo.note}</p>}
                    <div className="photo-note-row">
                      <input
                        value={noteDrafts[photo.id] ?? photo.note ?? ""}
                        onChange={(event) =>
                          setNoteDrafts((current) => ({
                            ...current,
                            [photo.id]: event.target.value
                          }))
                        }
                        maxLength={200}
                        placeholder="备注"
                      />
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        disabled={busy}
                        onClick={() => void saveNote(photo.id)}
                      >
                        保存
                      </button>
                    </div>
                  </figure>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function selectComparisonPhotos(photos: PhotoRecord[], mode: "latest" | "month"): PhotoRecord[] {
  if (mode === "latest" || photos.length < 2) {
    return photos.slice(0, 2);
  }

  const latest = photos[0];
  const month = latest.photoDate.slice(0, 7);
  const monthPhotos = photos.filter((photo) => photo.photoDate.startsWith(month));
  const oldestThisMonth = monthPhotos[monthPhotos.length - 1];
  return oldestThisMonth && oldestThisMonth.id !== latest.id ? [latest, oldestThisMonth] : photos.slice(0, 2);
}

function groupPhotosByDate(photos: PhotoRecord[]) {
  const byDate = new Map<string, PhotoRecord[]>();
  for (const photo of photos) {
    const list = byDate.get(photo.photoDate) ?? [];
    list.push(photo);
    byDate.set(photo.photoDate, list);
  }

  return Array.from(byDate.entries()).map(([date, items]) => ({ date, items }));
}

function photoUrl(photoId: number): string {
  return `/api/photos/${photoId}/file`;
}
