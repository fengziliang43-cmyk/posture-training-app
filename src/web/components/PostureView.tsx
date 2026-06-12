import { useEffect, useMemo, useState } from "react";
import { listPhotos, uploadPhoto, type PhotoRecord } from "../api";

const angles = [
  { value: "front", label: "正面" },
  { value: "side", label: "侧面" },
  { value: "back", label: "背面" }
] as const;

export function PostureView() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<(typeof angles)[number]["value"]>("front");
  const [compareBlend, setCompareBlend] = useState(50);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    refreshPhotos();
  }, []);

  const groupedPhotos = useMemo(() => groupPhotosByDate(photos), [photos]);
  const anglePhotos = useMemo(
    () => photos.filter((photo) => photo.angle === selectedAngle).slice(0, 2),
    [photos, selectedAngle]
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

    if (!fileInput?.files?.[0] || !dateInput || !angleInput) {
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("photoDate", dateInput.value);
      formData.append("angle", angleInput.value);
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

  return (
    <section className="stack">
      <div className="hero-card">
        <p className="eyebrow">体态</p>
        <h2>每周三角度留档</h2>
        <p>支持本地上传正面、侧面、背面照片，并按同角度做对比。</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      <form className="card posture-form" onSubmit={handleUpload}>
        <label>
          拍摄日期
          <input name="photoDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
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

        <button type="submit" disabled={busy}>
          {busy ? "上传中" : "上传照片"}
        </button>
      </form>

      <section className="card">
        <h3 className="section-title">对比视图</h3>
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
              正在对比 {angles.find((angle) => angle.value === selectedAngle)?.label} 的两张最新照片。
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
