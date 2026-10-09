import test from "node:test";
import assert from "node:assert/strict";
import { truncateAddress } from "./addressLabel.js";

test("addresses of five words or fewer stay complete", () => {
  assert.equal(truncateAddress("Rue Eiffel Le Colas Conflans"), "Rue Eiffel Le Colas Conflans");
  assert.equal(truncateAddress("حي عشرين أوت وسط مدينة"), "حي عشرين أوت وسط مدينة");
  assert.equal(truncateAddress("موقعي الحالي"), "موقعي الحالي");
});

test("long French and Arabic addresses keep five words followed by three dots", () => {
  assert.equal(truncateAddress("Rue Eiffel Le Colas Conflans Sainte Honorine France"), "Rue Eiffel Le Colas Conflans...");
  assert.equal(truncateAddress("حي عشرين أوت وسط مدينة مستغانم الجزائر"), "حي عشرين أوت وسط مدينة...");
});

test("word boundaries include repeated spaces, line breaks and nonbreaking spaces", () => {
  assert.equal(truncateAddress("  Rue\tEiffel  Le\nColas\u00a0Conflans France  "), "Rue Eiffel Le Colas Conflans...");
  assert.equal(truncateAddress("  موقعي الحالي  "), "موقعي الحالي");
  assert.equal(truncateAddress("Saint-Germain-en-Laye, Rue Eiffel Le Colas France"), "Saint-Germain-en-Laye, Rue Eiffel Le Colas...");
});

test("missing labels render safely and presentation leaves source data intact", () => {
  for (const value of [undefined, null, "", " \t\n"]) assert.equal(truncateAddress(value), "");
  const course = Object.freeze({ destination: "Rue Eiffel Le Colas Conflans France" });
  assert.equal(truncateAddress(course.destination), "Rue Eiffel Le Colas Conflans...");
  assert.equal(course.destination, "Rue Eiffel Le Colas Conflans France");
  assert.equal(truncateAddress(course.destination, 2), "Rue Eiffel...");
});
