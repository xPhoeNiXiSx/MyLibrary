import { Masthead } from "../masthead";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="page narrow">
      <Masthead account={false} />
      <h1 className="page-title">Connexion</h1>
      <LoginForm next={next ?? ""} />
    </main>
  );
}
