"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/auth";
import { runMigrations } from "@/lib/db";

export async function migrateAction(): Promise<void> {
  // Le proxy ferme déjà l'application, mais une action serveur s'appelle
  // directement par POST : elle vérifie la session elle-même.
  if (!(await isAuthenticated())) redirect("/login?next=/compte");

  await runMigrations();
  revalidatePath("/");
  revalidatePath("/compte");
}
