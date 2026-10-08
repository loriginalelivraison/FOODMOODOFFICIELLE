import React from "react";

/**
 * Champ « départ / destination » réutilisable (client + chauffeur).
 * Volontairement simple : saisie texte libre + bouton carte.
 * `tone` : green (départ), orange (destination), blue (chauffeur).
 */
export const MY_LOCATION_LABEL = "موقعي الحالي";

const TONE_CLASS = {
  green: "",
  orange: "is-orange",
  blue: "is-blue",
};

export default function DepartureField({
  id = "departure",
  label = "نقطة الانطلاق",
  placeholder = "اكتب عنواناً",
  value,
  onChange,
  onToggleMap,
  selectingOnMap = false,
  hasMapPoint = false,
  disabled = false,
  hint = "",
  mapPointHint = "📍 النقطة محددة على الخريطة.",
  tone = "green",
  inputRef = null,
  onFocus = null,
  maxLength = 120,
}) {
  const toneClass = TONE_CLASS[tone] || "";

  return (
    <div className={`departure-field ${toneClass}`} dir="rtl">
      <div className="departure-field-head">
        <label htmlFor={id}>{label}</label>
      </div>

      <div className={`departure-combo ${hasMapPoint ? "has-point" : ""}`}>
        <label className="departure-text-field" htmlFor={id}>
          <input
            ref={inputRef}
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            placeholder={placeholder}
            aria-label={label}
            maxLength={maxLength}
            disabled={disabled}
            autoComplete="off"
          />
        </label>

        {onToggleMap && (
          <button
            type="button"
            onClick={onToggleMap}
            disabled={disabled}
            className={selectingOnMap || hasMapPoint ? "departure-map-btn active" : "departure-map-btn"}
            aria-pressed={selectingOnMap}
          >
            {selectingOnMap ? "إلغاء" : "اختيار على الخريطة"}
          </button>
        )}
      </div>

      {hasMapPoint && mapPointHint ? (
        <p className="departure-map-hint">{mapPointHint}</p>
      ) : (
        hint && <p className="departure-hint">{hint}</p>
      )}
    </div>
  );
}
