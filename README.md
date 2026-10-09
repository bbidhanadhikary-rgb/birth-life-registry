# Birth Death Connect

Project Name: Universal Upazila E-Registration Tracking System (Ultimate Multi-Tenant Architecture)
Description:
Create a secure, modern, multi-tenant web application to ensure 100% birth and death registration targets. The interface must feature a global, sticky Header containing theme, language, and navigation controls. The application supports 4 distinct user roles with dedicated responsive dashboards, dual login methods, automated smart features, and role-based data restrictions.
Global Header & Navigation Layout:
The web application must include a persistent, clean global Header at the top of all pages containing the following items:
1. Home Button / Logo: Navigates back to the main landing page.
2. Language Toggle Button: Instantly switches the entire application interface between বাংলা (Bengali) and English.
3. Theme Toggle Button: Switches the system UI seamlessly between Light Mode and Dark Mode.
4. Login Panel Button / User Profile Dropdown: Displays the Login options if unauthenticated (with a "Forgot Password" reset function for password users), or shows the logged-in user's name, role, and a Logout button if authenticated.
5. Helpdesk / Manual Button: Opens a modal showcasing the step-by-step User Manual for different roles.
6. Contact Support Button: Quick links to reach the Upazila ICT/Administrative support team.
Scalable Multi-Upazila Architecture:
1. Super Admin Panel: Allows onboarding of any District and Upazila.
2. Dynamic Dropdown Engine: If Manirampur Upazila is selected, it must dynamically load its 1 Municipality and 17 Unions in exact order: মণিরামপুর পৌরসভা, ০১ নং রোহিতা, ০২ নং কাশিমনগর, ০৩ নং ভোজগাতি, ০৪ নং ঢাকুরিয়া, ০৫ নং হরিদাসকাটি, ০৬ নং মণিরামপুর, ০৭ নং খেদাপাড়া, ০৮ নং হরিহরনগর, ০৯ নং ঝাঁপা, ১০ নং মশ্বিমনগর, ১১ নং চালুয়াহাটি, ১২ নং শ্যামকুড়, ১৩ নং খানপুর, ১৪ নং দুর্বাডাঙ্গা, ১৫ নং কুলটিয়া, ১৬ নং নেহালপুর, ১৭ নং মনোহরপুর।
3. Strict Data Isolation: Data of one Upazila or Union must be completely invisible and inaccessible to users of another Upazila or Union.
Dual Login Options (Accessible via Header Login Button):
- Option A (Mobile & OTP): For field-level Health Workers and Village Police.
- Option B (Password Login): For Administrative Officers, UNOs, and Super Admins.
The system must automatically detect the user's role and route them to their specific dashboard upon authentication.
Strict Business Logic & Technical Protections:
1. Data Input Restriction: ONLY EPI/Health Workers can enter new data. Administrative Officers, Village Police, and UNOs CANNOT enter new cases or modify original worker inputs.
2. Duplicate Prevention: Use the Parent's NID for birth entries and Deceased's NID/Birth Certificate number for death entries as a unique constraint. Show instant validation errors for duplicates.
3. Offline Sync Capability: Enable local offline caching for Health Workers and Village Police; data should auto-sync once online.
4. System Audit Logs: Maintain an automated, invisible audit trail tracking timestamps and User IDs for all creations, status changes, or remark updates.
5. Storage Optimization: Keep attached document files for 90 days after the case changes to "Completed" with a valid Government Registration Number, then auto-purge files to save space, keeping text data intact.
6. Red Flags: If a Health Worker or Ward registers zero entries for 15 consecutive days, flag that section in Red on the UNO and Admin dashboards.
Bilingual Ultra-Simple Input Forms (Side-by-Side Bangla/English):
Fields must be displayed side-by-side (Bangla Box | English Box) to minimize effort for EPI/Health workers.
1. Birth Registration Form: Child's Name, Father's Name, Mother's Name, Parent's NID, Gender, DOB, Order of Child, 3 File Upload Attachments, and Smart Auto-Address (Worker enters "Village Name" only; Post Office, Ward, Union, Upazila, District, Division, and Country auto-populate instantly in both languages).
2. Death Registration Form: Mirrors Birth Form layout but replaces Child's Name with "Deceased Person's Name", requires Deceased's NID, and adds "Date of Death" and "Cause of Death". Includes 3 File Upload Attachments.
4 Dedicated User Dashboards & Scope-Limited Reports:
1. EPI / Health Worker Dashboard: Simple forms, local entry history with Admin/UNO remarks, "SMS Sent to Parent" simulated labels, and a 'Download My Report' button (Excel/PDF).
2. Administrative Officer Dashboard: Live feed of data/files from their Union, add remarks, update status (Pending, In Progress, Completed), input final Government Registration Number to close cases on system completion, trigger verification tasks to Ward's Village Police, display a progress bar tracking monthly targets (Births: 50, Deaths: 20 per union), and a 'Download Union Report' button.
3. Village Police Dashboard: Simplified mobile UI showing assigned houses in their Ward with a physical document checklist ([ ] EPI Card, [ ] Parent NID). Tap "Documents Collected" to instantly update the Admin view.
4. UNO Dashboard: Master view of all Unions within their upazila with analytical graphs tracking monthly targets, ability to add mandatory "UNO Remarks", and a 'Download Master Report' button.
Design Standards:
Completely mobile-responsive, modern, clean, multi-tenant capable, supporting seamless bilingual transitions and theme toggles from the global header.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://birth-life-registry.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/39cec6a2-955c-4059-b4fc-6b11d67c973a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
