import { mapEmbedUrl, mapPageUrl } from "../../utils/restaurant.js";

// An OpenStreetMap embed: no API key, nothing private sent. The credit must stay visible.
export default function RestaurantMap({ latitude, longitude, name }) {
  return (
    <figure className="map">
      <iframe
        title={`Map showing the location of ${name}`}
        src={mapEmbedUrl(latitude, longitude)}
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <figcaption>
        ©{" "}
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          OpenStreetMap contributors
        </a>
        {" · "}
        <a href={mapPageUrl(latitude, longitude)} target="_blank" rel="noopener noreferrer">
          View larger map
        </a>
      </figcaption>
    </figure>
  );
}
