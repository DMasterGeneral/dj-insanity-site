import Sample from '../../../../components/Sample.jsx';

/**
 * A photo from site.photos, or, while there is none, a marked empty frame (halftone, no image)
 * showing where the DJ's own photo will go.
 * @param {{ photo: { src: string|null, alt: string, placeholder?: boolean } }} props
 */
export default function PhotoSpot({ photo }) {
  if (photo.src) {
    return (
      <Sample as="figure" block when={photo.placeholder} className="c-photo">
        <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" />
      </Sample>
    );
  }
  return (
    <Sample as="figure" block when className="c-photo c-photo--empty">
      <figcaption className="c-photo__caption">
        <span className="c-photo__kicker">Photo goes here</span>
        <span className="c-photo__alt">{photo.alt}</span>
      </figcaption>
    </Sample>
  );
}
