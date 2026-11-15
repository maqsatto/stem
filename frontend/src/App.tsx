import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { AuthProvider } from "@/shared/auth";
import { AccessGuard } from "@/shared/components/AccessGuard";
import { AppShell } from "@/shared/components/AppShell";
import { RoleLayout } from "@/shared/components/RoleLayout";
import { AccountPage, LoginPage, RegisterPage } from "@/pages/AuthPages";
import { AdminAssessmentsPage } from "@/pages/AdminContentPages";
import {
  AdminAlgorithmsPage,
  AdminCompetenciesPage,
  AdminContentPage,
} from "@/pages/AdminPages";
import {
  AdminAuditPage,
  AdminClassesPage,
  AdminFilesPage,
  AdminUsersPage,
} from "@/pages/AdminSystemPages";
import { AdminLessonsPage, AdminProjectsPage, AdminTasksPage } from "@/pages/AdminContentPages";
import {
  HomePage,
  MlDetailPage,
  MlPage,
  NotFoundPage,
  ProjectsPage,
  PublicProjectPage,
  StemDetailPage,
  StemPage,
} from "@/pages/PublicPages";
import {
  StudentAssessmentDetailPage,
  StudentAssessmentsPage,
  StudentClassPage,
  StudentDashboardPage,
  StudentLessonDetailPage,
  StudentLessonsPage,
  StudentPracticePage,
  StudentProjectDetailPage,
  StudentProjectsPage,
  StudentResultsPage,
  StudentTaskDetailPage,
  StudentTasksPage,
} from "@/pages/StudentPages";
import {
  TeacherClassDetailPage,
  TeacherClassesPage,
  TeacherAssignmentsPage,
  TeacherDiagnosticsPage,
  TeacherResultsPage,
  TeacherReviewDetailPage,
  TeacherReviewsPage,
} from "@/pages/TeacherClassPages";
import {
  TeacherCurriculumPage,
  TeacherDashboardPage,
  TeacherLessonDetailPage,
  TeacherLessonsPage,
  TeacherMethodologyPage,
  TeacherProjectDetailPage,
  TeacherProjectsPage,
  TeacherTaskDetailPage,
  TeacherTasksPage,
  TeacherToolsPage,
} from "@/pages/TeacherPages";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function PublicLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function AccountRoute() {
  return (
    <AppShell>
      <AccessGuard>
        <AccountPage />
      </AccessGuard>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/ml" element={<MlPage />} />
              <Route path="/ml/:slug" element={<MlDetailPage />} />
              <Route path="/stem" element={<StemPage />} />
              <Route path="/stem/:slug" element={<StemDetailPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<PublicProjectPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/account" element={<AccountRoute />} />

            <Route path="/student" element={<RoleLayout role="student" />}>
              <Route index element={<Navigate to="/student/dashboard" replace />} />
              <Route path="dashboard" element={<StudentDashboardPage />} />
              <Route path="lessons" element={<StudentLessonsPage />} />
              <Route path="lessons/:id" element={<StudentLessonDetailPage />} />
              <Route path="tasks" element={<StudentTasksPage />} />
              <Route path="tasks/:id" element={<StudentTaskDetailPage />} />
              <Route path="projects" element={<StudentProjectsPage />} />
              <Route path="projects/:id" element={<StudentProjectDetailPage />} />
              <Route path="practice" element={<StudentPracticePage />} />
              <Route path="assessments" element={<StudentAssessmentsPage />} />
              <Route path="assessments/:id" element={<StudentAssessmentDetailPage />} />
              <Route path="results" element={<StudentResultsPage />} />
              <Route path="class" element={<StudentClassPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/teacher" element={<RoleLayout role="teacher" />}>
              <Route index element={<Navigate to="/teacher/dashboard" replace />} />
              <Route path="dashboard" element={<TeacherDashboardPage />} />
              <Route path="methodology" element={<TeacherMethodologyPage />} />
              <Route path="curriculum" element={<TeacherCurriculumPage />} />
              <Route path="lessons" element={<TeacherLessonsPage />} />
              <Route path="lessons/:id" element={<TeacherLessonDetailPage />} />
              <Route path="tasks" element={<TeacherTasksPage />} />
              <Route path="tasks/:id" element={<TeacherTaskDetailPage />} />
              <Route path="projects" element={<TeacherProjectsPage />} />
              <Route path="projects/:id" element={<TeacherProjectDetailPage />} />
              <Route path="classes" element={<TeacherClassesPage />} />
              <Route path="classes/:id" element={<TeacherClassDetailPage />} />
              <Route path="assignments" element={<TeacherAssignmentsPage />} />
              <Route path="reviews" element={<TeacherReviewsPage />} />
              <Route path="reviews/:id" element={<TeacherReviewDetailPage />} />
              <Route path="diagnostics" element={<TeacherDiagnosticsPage />} />
              <Route path="results" element={<TeacherResultsPage />} />
              <Route path="tools" element={<TeacherToolsPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            <Route path="/admin" element={<RoleLayout role="admin" />}>
              <Route index element={<Navigate to="/admin/content" replace />} />
              <Route path="content" element={<AdminContentPage />} />
              <Route path="algorithms" element={<AdminAlgorithmsPage />} />
              <Route path="competencies" element={<AdminCompetenciesPage />} />
              <Route path="lessons" element={<AdminLessonsPage />} />
              <Route path="tasks" element={<AdminTasksPage />} />
              <Route path="projects" element={<AdminProjectsPage />} />
              <Route path="assessments" element={<AdminAssessmentsPage />} />
              <Route path="files" element={<AdminFilesPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="classes" element={<AdminClassesPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
