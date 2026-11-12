import { useEffect, useMemo, useState } from "react";
import { deletePhoto, downloadPhotoFile, listPhotos, updatePhotoNote, uploadPhoto, type PhotoRecord } from "../api";
import { formatLocalDate } from "../../core/date";
import { formatDayLabel } from "../format";
import { formatLocalClock, orderOlderFirst } from "../photo-compare";
import { ScoliosisRiskGuide } from "./ScoliosisRiskGuide";
import { Icon, Segmented } from "./ui";

const angles = [
  { value: "front", label: "正面" },
  { value: "side", label: "侧面" },
  { value: "back", label: "背面" }
] as const;

type Angle = (typeof angles)[number]["value"];
type ViewType = "side" | "blend" | "slider";

const VIEW_OPTIONS: ReadonlyArray<{ value: ViewType; label: string }> = [
  { value: "side", label: "并排" },
  { value: "slider", label: "滑动" },
  { value: "blend", label: "叠加" }
];

export function PostureView() {
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<Angle>("front");
  const [compareMode, setCompareMode] = useState<"latest" | "month">("latest");
  const [viewType, setViewType] = useState<ViewType>("side");
  const [compareBlend, setCompareBlend] = useState(50);
  const [sliderPos, setSliderPos] = useState(50);
  const [showGuideLines, setShowGuideLines] = useState(false);
  const [guideY, setGuideY] = useState(40);
  const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadAngle, setUploadAngle] = useState<Angle>("front");
  const [uploadError, setUploadError] = useState<string | null>(null);
  // The photo whose details sheet is open.
  const [activePhotoId, setActivePhotoId] = useState<number | null>(null);
  const [sheetError, setSheetError] = useState<string | null>(null);

  useEffect(() => {
    refreshPhotos();
  }, []);

  useEffect(() => {
    let disposed = false;
    const createdUrls: string[] = [];

    async function loadPhotoFiles() {
      const entries = await Promise.all(
        photos.map(async (photo) => {
          try {
            const blob = await downloadPhotoFile(photo.id);
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            return [photo.id, url] as const;
          } catch {
            return null;
          }
        })
      );

      if (disposed) {
        createdUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setPhotoUrls(Object.fromEntries(entries.filter((entry): entry is readonly [number, string] => entry !== null)));
    }

    void loadPhotoFiles();

    return () => {
      disposed = true;
      createdUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photos]);

  // The details sheet closes on Escape, and the page behind it does not scroll while it is open.
  useEffect(() => {
    if (activePhotoId === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePhotoId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [activePhotoId]);

  const groupedPhotos = useMemo(() => groupPhotosByDate(photos), [photos]);
  const anglePhotos = useMemo(
    () => selectComparisonPhotos(photos.filter((photo) => photo.angle === selectedAngle), compareMode),
    [photos, selectedAngle, compareMode]
  );
  const comparisonReady = anglePhotos.length >= 2 && anglePhotos.every((photo) => photoUrls[photo.id]);
  const [olderPhoto, newerPhoto] = orderOlderFirst(anglePhotos);
  const selectedAngleLabel = angles.find((angle) => angle.value === selectedAngle)?.label ?? "";
  const selectedAngleCount = photos.filter((photo) => photo.angle === selectedAngle).length;
  const angleOptions = angles.map((angle) => ({
    value: angle.value,
    label: `${angle.label} ${photos.filter((photo) => photo.angle === angle.value).length}`
  }));
  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? null;

  async function refreshPhotos() {
    try {
      const response = await listPhotos();
      setPhotos(response.photos);
      setError(null);
    } catch {
      setError("体态照片加载失败。");
    }
  }

  function openUpload(angle: Angle) {
    setUploadAngle(angle);
    setUploadOpen(true);
    setUploadError(null);
    requestAnimationFrame(() => {
      document.getElementById("posture-upload")?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("photoFile") as HTMLInputElement | null;
    const dateInput = form.elements.namedItem("photoDate") as HTMLInputElement | null;
    const angleInput = form.elements.namedItem("angle") as HTMLInputElement | null;
    const noteInput = form.elements.namedItem("note") as HTMLInputElement | null;

    if (!fileInput?.files?.[0] || !dateInput || !angleInput) {
      setUploadError("请先选一张照片。");
      return;
    }

    setBusy(true);
    setUploadError(null);
    try {
      const originalFile = fileInput.files[0];
      const preparedFile = await preparePhotoUpload(originalFile);
      const formData = new FormData();
      formData.append("photoDate", dateInput.value);
      formData.append("angle", angleInput.value);
      formData.append("note", noteInput?.value ?? "");
      formData.append("file", preparedFile, originalFile.name);
      await uploadPhoto(formData);
      form.reset();
      setUploadOpen(false);
      await refreshPhotos();
    } catch {
      setUploadError("照片上传失败，请再试一次。");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeletePhoto(photoId: number) {
    if (!window.confirm("确定删除这张体态照片吗？删除后不可恢复。")) {
      return;
    }
    setBusy(true);
    setSheetError(null);
    try {
      await deletePhoto(photoId);
      setActivePhotoId(null);
      await refreshPhotos();
    } catch {
      setSheetError("删除照片失败。");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(photoId: number) {
    setBusy(true);
    setSheetError(null);
    try {
      const note = noteDrafts[photoId] ?? photos.find((photo) => photo.id === photoId)?.note ?? "";
      await updatePhotoNote(photoId, note);
      setActivePhotoId(null);
      await refreshPhotos();
    } catch {
      setSheetError("备注保存失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <p className="privacy-note" role="note">
        <Icon name="shield" size={20} />
        <span>只做人工对比，不做 AI 或医疗诊断。照片只保存在服务器，不发送给 DeepSeek。</span>
      </p>

      {error && <p className="error-text" role="alert">{error}</p>}

      <section className="card-solid compare-card">
        <div className="card-head-row">
          <h2>{selectedAngleLabel}对比</h2>
          {comparisonReady && (
            <button
              type="button"
              className="text-button"
              aria-pressed={showGuideLines}
              onClick={() => setShowGuideLines((prev) => !prev)}
            >
              {showGuideLines ? "隐藏参考线" : "显示参考线"}
            </button>
          )}
        </div>

        <Segmented label="选择角度" options={angleOptions} value={selectedAngle} onChange={setSelectedAngle} />

        {comparisonReady && olderPhoto && newerPhoto ? (
          <div className="compare-wrap">
            <Segmented label="对比方式" options={VIEW_OPTIONS} value={viewType} onChange={setViewType} />

            {viewType === "side" && (
              <div className="compare-side-by-side">
                <figure className="compare-side-figure">
                  <img src={photoUrls[olderPhoto.id]} alt={`较早的照片，${olderPhoto.photoDate}`} />
                  <span className="date-pill compare-side-date">{olderPhoto.photoDate}</span>
                  {showGuideLines && <GuideLineOverlay y={guideY} />}
                </figure>
                <figure className="compare-side-figure">
                  <img src={photoUrls[newerPhoto.id]} alt={`较新的照片，${newerPhoto.photoDate}`} />
                  <span className="date-pill compare-side-date">{newerPhoto.photoDate}</span>
                  {showGuideLines && <GuideLineOverlay y={guideY} />}
                </figure>
              </div>
            )}

            {viewType === "blend" && (
              <>
                <div className="compare-stage">
                  <img className="compare-image base" src={photoUrls[olderPhoto.id]} alt="较早的照片" />
                  <img
                    className="compare-image overlay"
                    src={photoUrls[newerPhoto.id]}
                    alt="较新的照片"
                    style={{ opacity: compareBlend / 100 }}
                  />
                  {showGuideLines && <GuideLineOverlay y={guideY} />}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="较早与较新照片的叠加比例"
                  value={compareBlend}
                  onChange={(event) => setCompareBlend(Number(event.target.value))}
                />
              </>
            )}

            {viewType === "slider" && (
              <>
                <div className="compare-stage">
                  <img className="compare-image base" src={photoUrls[newerPhoto.id]} alt="较新的照片" />
                  {/* Same size as the base photo, cut off from the right: both photos stay lined up. */}
                  <img
                    className="compare-image"
                    src={photoUrls[olderPhoto.id]}
                    alt="较早的照片"
                    style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
                  />
                  <span className="compare-slider-line" style={{ left: `${sliderPos}%` }} aria-hidden="true" />
                  {showGuideLines && <GuideLineOverlay y={guideY} />}
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  aria-label="拖动查看较早与较新的照片"
                  value={sliderPos}
                  onChange={(event) => setSliderPos(Number(event.target.value))}
                />
              </>
            )}

            {showGuideLines && (
              <label className="guide-y-field">
                <span>水平参考线位置：拖到肩线或骨盆处，对比两张是否一样高。只帮你对齐，不测量角度。</span>
                <input
                  type="range"
                  min="10"
                  max="90"
                  value={guideY}
                  onChange={(event) => setGuideY(Number(event.target.value))}
                />
              </label>
            )}

            <div className="compare-caption">
              <p className="muted small">
                {viewType === "side" && `左：${olderPhoto.photoDate}（较早） · 右：${newerPhoto.photoDate}（较新）`}
                {viewType === "blend" && `底：${olderPhoto.photoDate}（较早） · 上层半透明：${newerPhoto.photoDate}（较新）`}
                {viewType === "slider" && `滑块左侧：${olderPhoto.photoDate}（较早） · 右侧：${newerPhoto.photoDate}（较新）`}
                {compareMode === "latest" ? " · 最近两张" : " · 本月第一张与最新一张"}
              </p>
              <button
                type="button"
                className="text-button"
                onClick={() => setCompareMode(compareMode === "latest" ? "month" : "latest")}
              >
                {compareMode === "latest" ? "改看本月第一张与最新一张" : "改看最近两张"}
              </button>
            </div>
          </div>
        ) : anglePhotos.length >= 2 ? (
          <p className="muted">正在加载照片……</p>
        ) : (
          <div className="compare-empty">
            <p>
              {selectedAngleCount === 0
                ? `还没有${selectedAngleLabel}照片。`
                : `${selectedAngleLabel}照片只有 ${selectedAngleCount} 张。`}
              同一个角度有两张，才能对比。
            </p>
            <button type="button" className="secondary-button" onClick={() => openUpload(selectedAngle)}>
              添加{selectedAngleLabel}照片
            </button>
          </div>
        )}
      </section>

      <details
        className="fold-card upload-row"
        id="posture-upload"
        open={uploadOpen}
        onToggle={(event) => {
          const isOpen = event.currentTarget.open;
          setUploadOpen(isOpen);
          if (isOpen) setUploadAngle(selectedAngle);
        }}
      >
        <summary>
          <Icon name="camera" />
          <span>添加照片</span>
          <small>每周正面、侧面、背面各一张</small>
          <Icon name="right" size={16} />
        </summary>
        <form className="upload-form" onSubmit={handleUpload}>
          <input type="hidden" name="angle" value={uploadAngle} />
          <div className="field-block">
            <div className="field-head">
              <span>角度</span>
            </div>
            <Segmented label="这张照片的角度" options={angles} value={uploadAngle} onChange={setUploadAngle} />
          </div>

          <label>
            拍摄日期
            <input name="photoDate" type="date" defaultValue={formatLocalDate()} />
          </label>

          <label>
            照片文件
            <input name="photoFile" type="file" accept="image/*" />
          </label>

          <label>
            备注（选填）
            <input name="note" maxLength={200} placeholder="比如：自然站姿、训练后、腰酸低" />
          </label>

          {uploadError && <p className="error-text" role="alert">{uploadError}</p>}
          <button type="submit" className="wide" disabled={busy}>
            {busy ? "上传中" : "上传照片"}
          </button>
        </form>
      </details>

      <section className="card-solid photo-archive">
        <div className="card-head-row">
          <h3>照片档案</h3>
          {photos.length > 0 && <span className="muted-text">共 {photos.length} 张</span>}
        </div>

        {groupedPhotos.length === 0 ? (
          <div className="empty-state">
            <strong>还没有体态照片</strong>
            <p>从正面、侧面、背面各拍一张，之后就能按同一角度人工对比。</p>
          </div>
        ) : (
          groupedPhotos.map((group) => (
            <div className="photo-day" key={group.date}>
              <div className="photo-day-head">
                <b>{formatDayLabel(group.date)}</b>
                <span>{group.items.length} 张</span>
              </div>
              <div className="thumb-grid">
                {group.items.map((photo) => (
                  <button
                    type="button"
                    className="thumb"
                    key={photo.id}
                    aria-label={`${formatAngleLabel(photo.angle)}照片，${photo.photoDate}，查看详情`}
                    onClick={() => {
                      setSheetError(null);
                      setActivePhotoId(photo.id);
                    }}
                  >
                    {photoUrls[photo.id] ? (
                      <img src={photoUrls[photo.id]} alt="" />
                    ) : (
                      <span className="thumb-loading">加载中</span>
                    )}
                    <span className="thumb-label">{formatAngleLabel(photo.angle)}</span>
                    {photo.note && <Icon name="edit" size={14} />}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <ScoliosisRiskGuide />

      {activePhoto && (
        <div className="sheet-backdrop" role="presentation" onClick={() => setActivePhotoId(null)}>
          <div
            className="sheet"
            role="dialog"
            aria-modal="true"
            aria-label="照片详情"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="sheet-handle" aria-hidden="true" />
            {photoUrls[activePhoto.id] ? (
              <img src={photoUrls[activePhoto.id]} alt={`${formatAngleLabel(activePhoto.angle)}照片，${activePhoto.photoDate}`} />
            ) : (
              <p className="muted">照片加载中……</p>
            )}
            <div className="sheet-meta">
              <b>{formatAngleLabel(activePhoto.angle)}</b>
              <span>
                {formatDayLabel(activePhoto.photoDate)} · {formatLocalClock(activePhoto.createdAt)}
              </span>
            </div>
            <label>
              备注
              <input
                value={noteDrafts[activePhoto.id] ?? activePhoto.note ?? ""}
                onChange={(event) =>
                  setNoteDrafts((current) => ({
                    ...current,
                    [activePhoto.id]: event.target.value
                  }))
                }
                maxLength={200}
                placeholder="比如：自然站姿、训练后"
              />
            </label>
            {sheetError && <p className="error-text" role="alert">{sheetError}</p>}
            <div className="button-row">
              <button type="button" disabled={busy} onClick={() => void saveNote(activePhoto.id)}>
                保存备注
              </button>
              <button type="button" className="danger-button" disabled={busy} onClick={() => void handleDeletePhoto(activePhoto.id)}>
                删除照片
              </button>
            </div>
            <button type="button" className="text-button" onClick={() => setActivePhotoId(null)}>
              关闭
            </button>
          </div>
        </div>
      )}
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

function GuideLineOverlay({ y }: { y: number }) {
  return (
    <div className="guide-lines" aria-hidden="true">
      <span className="guide-line-v" />
      <span className="guide-line-h" style={{ top: `${y}%` }} />
    </div>
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

function formatAngleLabel(angle: string): string {
  if (angle === "front") return "正面";
  if (angle === "side") return "侧面";
  if (angle === "back") return "背面";
  return angle;
}

async function preparePhotoUpload(file: File): Promise<Blob | File> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let width = img.width;
      let height = img.height;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
        },
        "image/jpeg",
        0.82
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}
