"use client";

import { useEffect, useRef, useState } from "react";

type MapPoint = {
  id: string;
  label: string;
  title: string;
  subtitle: string;
  query: string;
  href: string;
  latitude: number;
  longitude: number;
};

type MapPointGroup = {
  id: string;
  title: string;
  subtitle: string;
  points: MapPoint[];
};

declare global {
  interface Window {
    google?: any;
    __thanksgivingGoogleMapsPromise?: Promise<any>;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadGoogleMaps(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__thanksgivingGoogleMapsPromise) {
    return window.__thanksgivingGoogleMapsPromise;
  }

  window.__thanksgivingGoogleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-google-maps-loader="thanksgiving"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google?.maps ?? null), {
        once: true
      });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Google Maps failed to load.")),
        {
          once: true
        }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "thanksgiving";
    script.onload = () => resolve(window.google?.maps ?? null);
    script.onerror = () => reject(new Error("Google Maps failed to load."));
    document.head.appendChild(script);
  });

  return window.__thanksgivingGoogleMapsPromise;
}

function buildMarkerConfig(maps: any, groupId: string) {
  if (groupId === "recommended") {
    return {
      icon: {
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#d94b3d",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeOpacity: 1,
        strokeWeight: 2.5,
        scale: 10
      },
      label: {
        text: "★",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: "700"
      },
      zIndex: 300
    };
  }

  if (groupId === "walmart") {
    return {
      icon: {
        path: maps.SymbolPath.CIRCLE,
        fillColor: "#1f7ae0",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeOpacity: 1,
        strokeWeight: 2.5,
        scale: 9
      },
      label: {
        text: "W",
        color: "#ffffff",
        fontSize: "10px",
        fontWeight: "700"
      },
      zIndex: 250
    };
  }

  return {
    icon: {
      path: maps.SymbolPath.CIRCLE,
      fillColor: "#f7f3ed",
      fillOpacity: 0.98,
      strokeColor: "#181c22",
      strokeOpacity: 1,
      strokeWeight: 2.5,
      scale: 8
    },
    label: {
      text: "",
      color: "#181c22",
      fontSize: "10px",
      fontWeight: "700"
    },
    zIndex: 200
  };
}

export function MapExplorer({
  title,
  subtitle,
  groups,
  apiKey
}: {
  title: string;
  subtitle: string;
  groups: MapPointGroup[];
  apiKey: string;
}) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const boundsRef = useRef<any>(null);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error" | "missing-key">(
    apiKey ? "loading" : "missing-key"
  );
  const [localPreview, setLocalPreview] = useState(false);
  const visibleGroups = groups.filter((group) => group.points.length > 0);
  const allPoints = visibleGroups.flatMap((group) =>
    group.points.map((point) => ({
      ...point,
      groupId: group.id
    }))
  );
  const pointsSignature = allPoints
    .map((point) => `${point.id}:${point.groupId}:${point.latitude}:${point.longitude}`)
    .join("|");

  useEffect(() => {
    const hostname = window.location.hostname;
    setLocalPreview(
      hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
    );
  }, []);

  useEffect(() => {
    if (!apiKey) {
      setMapState("missing-key");
      return;
    }

    if (!mapRef.current || allPoints.length === 0) {
      return;
    }

    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!maps || cancelled || !mapRef.current) {
          return;
        }

        const center = {
          lat: allPoints.reduce((sum, point) => sum + point.latitude, 0) / allPoints.length,
          lng: allPoints.reduce((sum, point) => sum + point.longitude, 0) / allPoints.length
        };

        const map = new maps.Map(mapRef.current, {
          center,
          zoom: 10,
          minZoom: 9,
          maxZoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          mapTypeId: maps.MapTypeId.ROADMAP,
          styles: [
            { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
            { featureType: "transit", stylers: [{ visibility: "off" }] },
            {
              featureType: "poi.business",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        });

        const bounds = new maps.LatLngBounds();
        const infoWindow = new maps.InfoWindow({ maxWidth: 228 });
        mapInstanceRef.current = map;
        boundsRef.current = bounds;

        allPoints.forEach((point) => {
          const position = { lat: point.latitude, lng: point.longitude };
          const markerConfig = buildMarkerConfig(maps, point.groupId);
          const marker = new maps.Marker({
            map,
            position,
            title: point.title,
            icon: markerConfig.icon,
            label: markerConfig.label,
            zIndex: markerConfig.zIndex
          });

          marker.addListener("click", () => {
            infoWindow.setContent(
              `<div style="max-width:196px;padding:2px 0 0;">
                <div style="font-weight:700;font-size:13px;line-height:1.35;margin-bottom:4px;word-break:break-word;">${escapeHtml(point.title)}</div>
                <div style="font-size:12px;line-height:1.45;color:#4b5563;word-break:break-word;">${escapeHtml(point.subtitle)}</div>
                <div style="margin-top:8px;font-size:12px;"><a href="${escapeHtml(point.href)}" target="_blank" rel="noreferrer">Open in Maps</a></div>
              </div>`
            );
            infoWindow.open({ anchor: marker, map });
          });

          bounds.extend(position);
        });

        if (allPoints.length === 1) {
          map.setZoom(11);
          maps.event.addListenerOnce(map, "idle", () => {
            setMapState("ready");
          });
        } else {
          map.fitBounds(bounds, 64);
          maps.event.addListenerOnce(map, "idle", () => {
            const zoom = map.getZoom() ?? 10;
            if (zoom < 10) {
              map.setZoom(10);
            } else if (zoom > 12) {
              map.setZoom(12);
            }
            setMapState("ready");
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMapState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, pointsSignature]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) {
      return;
    }

    const element = mapRef.current;
    const observer = new ResizeObserver(() => {
      const map = mapInstanceRef.current;
      const bounds = boundsRef.current;

      if (!map || !bounds) {
        return;
      }

      window.google.maps.event.trigger(map, "resize");

      if (allPoints.length === 1) {
        map.setCenter(bounds.getCenter());
        map.setZoom(11);
        return;
      }

      map.fitBounds(bounds, 64);
    });

    observer.observe(element);

    return () => observer.disconnect();
  }, [allPoints.length, pointsSignature]);

  if (visibleGroups.length === 0 || allPoints.length === 0) {
    return null;
  }

  return (
    <div className="map-explorer">
      <div className="map-explorer-topline">
        <div>
          <p className="map-explorer-title">{title}</p>
          <p className="map-explorer-subtitle">{subtitle}</p>
        </div>
      </div>
      <section className="map-shared-card" aria-label="Shared area map">
        <div className="map-shared-legend" aria-label="Map legend">
          {visibleGroups.map((group) => (
            <span className="map-legend-chip" key={group.id}>
              <span
                className={[
                  "map-legend-dot",
                  group.id === "recommended"
                    ? "map-legend-dot--recommended"
                    : group.id === "walmart"
                      ? "map-legend-dot--walmart"
                      : "map-legend-dot--stay"
                ].join(" ")}
                aria-hidden="true"
              />
              {group.title}
            </span>
          ))}
        </div>
        <div className="map-shared-frame">
          <div aria-busy={mapState === "loading"} className="map-live-frame" ref={mapRef} />
          {mapState === "loading" ? (
            <div className="map-live-state">Loading Google map...</div>
          ) : null}
          {mapState === "error" ? (
            <div className="map-live-state map-live-state--error">
              Google map failed to load. Check the API key and allowed referrers.
            </div>
          ) : null}
          {mapState === "missing-key" ? (
            <div className="map-live-state map-live-state--error">
              Google Maps API key is missing.
            </div>
          ) : null}
        </div>
        {localPreview ? (
          <p className="map-local-note">
            Local preview warning: this key is currently restricted to your Vercel domain, so
            localhost will stay blocked until you also allow `http://localhost:3000/*`.
          </p>
        ) : null}
      </section>
    </div>
  );
}
