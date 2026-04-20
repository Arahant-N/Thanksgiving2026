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

function buildMarkerCode(groupId: string, index: number) {
  return groupId === "supermarkets" ? `G${index + 1}` : `${index + 1}`;
}

function buildMarkerIcon(groupId: string) {
  const color = groupId === "supermarkets" ? "#6eb0ff" : "#f7f3ed";

  return {
    path: window.google.maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: groupId === "supermarkets" ? 0.95 : 0.92,
    strokeColor: "#181c22",
    strokeOpacity: 1,
    strokeWeight: 2,
    scale: 10
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
  const [mapState, setMapState] = useState<"loading" | "ready" | "error" | "missing-key">(
    apiKey ? "loading" : "missing-key"
  );
  const hostname = typeof window === "undefined" ? "" : window.location.hostname;
  const localPreview =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const visibleGroups = groups.filter((group) => group.points.length > 0);
  const allPoints = visibleGroups.flatMap((group) =>
    group.points.map((point, index) => ({
      ...point,
      groupId: group.id,
      markerCode: buildMarkerCode(group.id, index)
    }))
  );

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
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          styles: [
            { elementType: "geometry", stylers: [{ color: "#181c22" }] },
            { elementType: "labels.text.fill", stylers: [{ color: "#d5dbe2" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#181c22" }] },
            { featureType: "poi", stylers: [{ visibility: "off" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#232a32" }] },
            {
              featureType: "road",
              elementType: "labels.text.fill",
              stylers: [{ color: "#b7c0ca" }]
            },
            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0f1822" }] }
          ]
        });

        const bounds = new maps.LatLngBounds();
        const infoWindow = new maps.InfoWindow();

        allPoints.forEach((point) => {
          const position = { lat: point.latitude, lng: point.longitude };
          const marker = new maps.Marker({
            map,
            position,
            title: point.title,
            label: {
              text: point.markerCode,
              color: "#181c22",
              fontSize: "11px",
              fontWeight: "700"
            },
            icon: buildMarkerIcon(point.groupId)
          });

          marker.addListener("click", () => {
            infoWindow.setContent(
              `<div style="min-width:220px;padding:4px 2px 2px;">
                <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${point.title}</div>
                <div style="font-size:12px;line-height:1.45;color:#4b5563;">${point.subtitle}</div>
                <div style="margin-top:8px;"><a href="${point.href}" target="_blank" rel="noreferrer">Open in Maps</a></div>
              </div>`
            );
            infoWindow.open({ anchor: marker, map });
          });

          bounds.extend(position);
        });

        if (allPoints.length === 1) {
          map.setZoom(11);
        } else {
          map.fitBounds(bounds, 64);
        }

        setMapState("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setMapState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allPoints, apiKey]);

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
        <div className="map-shared-legend" aria-hidden="true">
          {visibleGroups.map((group) => (
            <span className="map-legend-chip" key={group.id}>
              <span
                className={
                  group.id === "supermarkets"
                    ? "map-legend-dot map-legend-dot--store"
                    : "map-legend-dot map-legend-dot--stay"
                }
              />
              {group.title}
            </span>
          ))}
        </div>
        <div className="map-shared-frame">
          <div className="map-live-frame" ref={mapRef} />
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
