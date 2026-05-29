import {
  MUNICIPIO_EMAIL,
  MUNICIPIO_PASSWORD,
} from "./config/auth.js";
import { createUser, findByEmail } from "./store/users.js";
import { seedSpotsIfEmpty } from "./store/spots.js";

export async function runSeed() {
  seedSpotsIfEmpty();

  if (!MUNICIPIO_EMAIL || !MUNICIPIO_PASSWORD) {
    console.warn(
      "[SEM] Definí MUNICIPIO_EMAIL y MUNICIPIO_PASSWORD en .env para la cuenta Municipalidad.",
    );
    return;
  }

  if (!findByEmail(MUNICIPIO_EMAIL)) {
    await createUser({
      email: MUNICIPIO_EMAIL,
      password: MUNICIPIO_PASSWORD,
      name: "Municipalidad de Salta",
      role: "municipio",
      active: true,
      activationPending: false,
    });
    console.log(`Cuenta Municipio lista: ${MUNICIPIO_EMAIL}`);
  }
}
