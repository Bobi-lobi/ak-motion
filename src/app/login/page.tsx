import { LoginPageClient } from "@/components/login-page-client";
import { loadPublicHomeData } from "@/lib/public-home-server";

export const revalidate = 30;

export default async function LoginPage() {
  const { counts, landing } = await loadPublicHomeData();
  return <LoginPageClient initialCounts={counts} initialLanding={landing} />;
}
