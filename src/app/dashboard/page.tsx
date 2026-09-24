import { redirect } from "next/navigation";

/**
 * The portal has no home dashboard yet, and portal.godnd.co/ redirects here.
 * Without this page that redirect landed on a 404; Experiences is the one
 * module that exists, so it is where the portal opens.
 */
export default function DashboardIndex() {
  redirect("/dashboard/experiences");
}
