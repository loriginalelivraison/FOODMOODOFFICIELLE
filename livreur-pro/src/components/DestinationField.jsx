import React, { useState } from "react";
import DepartureField from "./DepartureField.jsx";
import AddressLabel from "./AddressLabel.jsx";
import { readDestinationHistory, rememberDestination, searchDestinations } from "../utils/destinationSearch.js";

export default function DestinationField({ onSelectPlace, keepHistory = false, suggestedPlaces = [], ...props }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(readDestinationHistory);
  const isEmpty = !props.value.trim();
  const allResults = isEmpty ? suggestedPlaces : searchDestinations(props.value);
  const results = allResults.slice(0, 50);
  const recent = isEmpty && keepHistory
    ? history.filter((place) => !suggestedPlaces.some((suggestion) => suggestion.id === place.id))
    : [];
  const renderPlace = (place) => <button type="button" key={place.id} onMouseDown={(event) => event.preventDefault()} onClick={() => {
    setOpen(false);
    if (keepHistory) setHistory(rememberDestination(place));
    onSelectPlace(place);
  }}>
    <strong dir="auto"><AddressLabel text={place.name_ar || place.search_name} /></strong>
    <small dir="auto">{place.category_ar || place.category} · <AddressLabel text={place.commune_secteur_ar || place.commune_secteur} /></small>
  </button>;
  return <div className="local-destination-field" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <DepartureField {...props}
      onFocus={() => setOpen(true)}
      onChange={(event) => { setOpen(true); props.onChange(event); }}
      onToggleMap={() => { setOpen(false); props.onToggleMap(); }}
    />
    {open && !props.disabled && <div className="local-destination-results" dir="rtl">
      {isEmpty && results.length > 0 && <p>أماكن مقترحة</p>}
      {results.map(renderPlace)}
      {allResults.length > results.length && <p>نتائج أخرى متاحة، اكتب اسمًا أدق.</p>}
      {recent.length > 0 && <p>الوجهات الأخيرة</p>}
      {recent.map(renderPlace)}
      {!isEmpty && !results.length && <p>لا يوجد مكان محلي مطابق</p>}
      {results.some((place) => typeof place.id === "string" && place.id.startsWith("osm:")) &&
        <p>بيانات الأماكن © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">مساهمو OpenStreetMap</a></p>}
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); props.onToggleMap(); }}>
        اختيار على الخريطة
      </button>
    </div>}
  </div>;
}
