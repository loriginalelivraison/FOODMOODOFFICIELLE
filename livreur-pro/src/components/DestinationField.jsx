import React, { useState } from "react";
import DepartureField from "./DepartureField.jsx";
import AddressLabel from "./AddressLabel.jsx";
import { readDestinationHistory, rememberDestination, searchDestinations } from "../utils/destinationSearch.js";

export default function DestinationField({ onSelectPlace, keepHistory = false, ...props }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(readDestinationHistory);
  const results = props.value.trim() ? searchDestinations(props.value) : keepHistory ? history : [];
  return <div className="local-destination-field" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <DepartureField {...props}
      onFocus={() => setOpen(true)}
      onChange={(event) => { setOpen(true); props.onChange(event); }}
      onToggleMap={() => { setOpen(false); props.onToggleMap(); }}
    />
    {open && !props.disabled && <div className="local-destination-results" dir="rtl">
      {!props.value.trim() && results.length > 0 && <p>آخر الوجهات · Destinations récentes</p>}
      {results.map((place) => <button type="button" key={place.id} onMouseDown={(event) => event.preventDefault()} onClick={() => {
        setOpen(false);
        if (keepHistory) setHistory(rememberDestination(place));
        onSelectPlace(place);
      }}>
        <strong dir="auto"><AddressLabel text={place.search_name} /></strong>
        <small dir="auto">{place.category} · <AddressLabel text={place.commune_secteur} /></small>
      </button>)}
      {props.value.trim() && !results.length && <p>لا يوجد مكان محلي مطابق · Aucun lieu local correspondant</p>}
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); props.onToggleMap(); }}>
        اختيار على الخريطة · Choisir sur la carte
      </button>
    </div>}
  </div>;
}
