import React from "react";
import { truncateAddress } from "../utils/addressLabel.js";

export default function AddressLabel({ text, className }) {
  const fullAddress = String(text ?? "").trim();
  const label = truncateAddress(fullAddress);
  return <span className={className} dir="auto" title={fullAddress}
    aria-label={label !== fullAddress ? fullAddress : undefined}>{label}</span>;
}
