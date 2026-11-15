import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, GraduationCap, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { errorMessage, http } from "@/shared/api";
import { roleHome, useAuth } from "@/shared/auth";
import { Brand } from "@/shared/components/AppShell";
import { roleLabels } from "@/shared/format";
import { useTitle } from "@/shared/hooks";
import type { Me } from "@/shared/types";
import {
  Alert,
  Button,
  Card,
  DemoNotice,
  Field,
  LinkButton,
  PageHeader,
  TextInput,
} from "@/shared/ui";

const loginSchema = z.object({
  email: z.string().email("Дұрыс email енгізіңіз."),
  password: z.string().min(1, "Құпиясөзді енгізіңіз."),
});

type LoginValues = z.infer<typeof loginSchema>;

const registerSchema = z
  .object({
    display_name: z.string().min(2, "Аты-жөні кемінде 2 таңба болуы керек.").max(160),
    email: z.string().email("Дұрыс email енгізіңіз."),
    password: z
      .string()
      .min(8, "Құпиясөз кемінде 8 таңба болуы керек.")
      .max(128)
      .regex(/[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/, "Құпиясөзде әріп болуы керек.")
      .regex(/\d/, "Құпиясөзде цифр болуы керек."),
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "Құпиясөздер сәйкес келмейді.",
    path: ["confirm"],
  });

type RegisterValues = z.infer<typeof registerSchema>;

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="relative hidden overflow-hidden bg-ink-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          className="pointer-events-none absolute -top-24 -right-24 size-[28rem] rounded-full bg-brand-500/20 blur-3xl"
          aria-hidden
        />
        <Brand to="/" />
        <div className="relative max-w-lg">
          <p className="text-xs font-bold tracking-[0.2em] text-brand-300 uppercase">
            ML + STEM LAB
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight">
            Бір платформа — үш кабинет және біртұтас оқу тізбегі
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Оқушы алгоритмнен жобаға дейін өтеді. Мұғалім сыныпты басқарып, нәтижені
            бақылайды. Әкімші мазмұнды өз бетінше жариялайды. Барлық деректер бір backend
            және PostgreSQL базасында сақталады.
          </p>
          <div className="mt-8 grid gap-3 text-sm">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <GraduationCap className="size-5 text-brand-300" aria-hidden />
              Оқушы: сабақтар, тапсырмалар, жобалар, диагностика
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <ShieldCheck className="size-5 text-brand-300" aria-hidden />
              Мұғалім: сыныптар, тексерулер, CSV есептер
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <KeyRound className="size-5 text-brand-300" aria-hidden />
              Әкімші: CMS, файлдар, қолжетімділік
            </div>
          </div>
        </div>
        <p className="relative text-xs text-slate-500">
          Демо-нұсқа · Ғылыми-әдістемелік мазмұнды тапсырыс беруші бекітеді
        </p>
      </div>
      <div className="flex min-h-screen flex-col bg-slate-50">
        <div className="flex items-center justify-between px-5 py-4 lg:hidden">
          <Brand to="/" />
          <Link to="/" className="text-sm font-semibold no-underline">
            Басты бет
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  useTitle("Кіру");
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  async function submit(values: LoginValues) {
    setApiError(null);
    try {
      const me = await login(values.email.trim(), values.password);
      const from = (location.state as { from?: string } | null)?.from;
      const allowedPrefix =
        me.role === "student"
          ? "/student"
          : me.role === "teacher"
            ? "/teacher"
            : "/admin";
      navigate(from && (from.startsWith(allowedPrefix) || from === "/account") ? from : roleHome(me.role), {
        replace: true,
      });
    } catch (error) {
      setApiError(errorMessage(error));
    }
  }

  const demoAccounts = [
    { role: "Оқушы", email: "student@mlstem.kz", password: "Student123!" },
    { role: "Мұғалім", email: "teacher@mlstem.kz", password: "Teacher123!" },
    { role: "Әкімші", email: "admin@mlstem.kz", password: "Admin123!" },
  ];

  return (
    <AuthLayout>
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">Кіру</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950">
          ML + STEM LAB кабинетіне кіру
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Email мен құпиясөзді енгізіңіз. Жүйе сізді рөліңізге сәйкес кабинетке бағыттайды.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(submit)(event)}>
          <Field label="Email" htmlFor="login-email" required error={errors.email?.message}>
            <TextInput
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="student@mlstem.kz"
              {...register("email")}
            />
          </Field>
          <Field
            label="Құпиясөз"
            htmlFor="login-password"
            required
            error={errors.password?.message}
          >
            <TextInput
              id="login-password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
          </Field>
          {apiError ? <Alert tone="error">{apiError}</Alert> : null}
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Кіру
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Аккаунтыңыз жоқ па?{" "}
          <Link to="/register" className="font-semibold no-underline">
            Оқушы ретінде тіркелу
          </Link>
        </p>
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            Демо-аккаунттар (тек MVP сынағы үшін)
          </p>
          <div className="mt-2 grid gap-1.5">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs hover:border-brand-300 hover:bg-brand-50"
                onClick={() => {
                  setValue("email", account.email);
                  setValue("password", account.password);
                }}
              >
                <span className="font-semibold text-slate-800">{account.role}</span>
                <span className="text-slate-500">{account.email}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>
      <div className="mt-4">
        <DemoNotice>
          Демо-аккаунттар мен мысал деректер тек қабылдау сынағына арналған. Production-да
          құпиясөздер мен seed деректерін міндетті түрде ауыстырыңыз.
        </DemoNotice>
      </div>
    </AuthLayout>
  );
}

export function RegisterPage() {
  useTitle("Тіркелу");
  const { user, register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [apiError, setApiError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { display_name: "", email: "", password: "", confirm: "" },
  });

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  async function submit(values: RegisterValues) {
    setApiError(null);
    try {
      const me = await registerUser({
        display_name: values.display_name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate(roleHome(me.role), { replace: true });
    } catch (error) {
      setApiError(errorMessage(error));
    }
  }

  return (
    <AuthLayout>
      <Card className="p-6 sm:p-8">
        <p className="text-xs font-bold tracking-[0.18em] text-brand-700 uppercase">Тіркелу</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink-950">Оқушы аккаунты</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Өзін-өзі тіркеу тек оқушы рөлі үшін ашық. Мұғалім аккаунтын әкімші шақырады.
          Жеке деректерді барынша аз беріңіз: тек аты-жөні мен email.
        </p>
        <form className="mt-6 space-y-4" onSubmit={(event) => void handleSubmit(submit)(event)}>
          <Field
            label="Аты-жөні"
            htmlFor="register-name"
            required
            error={errors.display_name?.message}
          >
            <TextInput
              id="register-name"
              autoComplete="name"
              placeholder="Айгүл Нұрланова"
              {...register("display_name")}
            />
          </Field>
          <Field label="Email" htmlFor="register-email" required error={errors.email?.message}>
            <TextInput
              id="register-email"
              type="email"
              autoComplete="email"
              placeholder="student@example.kz"
              {...register("email")}
            />
          </Field>
          <Field
            label="Құпиясөз"
            htmlFor="register-password"
            required
            hint="Кемінде 8 таңба, әріп және цифр."
            error={errors.password?.message}
          >
            <TextInput
              id="register-password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
          </Field>
          <Field
            label="Құпиясөзді қайталау"
            htmlFor="register-confirm"
            required
            error={errors.confirm?.message}
          >
            <TextInput
              id="register-confirm"
              type="password"
              autoComplete="new-password"
              {...register("confirm")}
            />
          </Field>
          {apiError ? <Alert tone="error">{apiError}</Alert> : null}
          <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
            Тіркелу
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Аккаунтыңыз бар ма?{" "}
          <Link to="/login" className="font-semibold no-underline">
            Кіру
          </Link>
        </p>
        <p className="mt-4 text-xs leading-5 text-slate-500">
          Тіркелу арқылы платформаның оқу мақсатындағы деректерді өңдеу қағидаларымен
          келісесіз. Есептік жазбаны әкімші кез келген уақытта өшіре алады.
        </p>
      </Card>
      <div className="mt-4">
        <DemoNotice />
      </div>
    </AuthLayout>
  );
}

const profileSchema = z.object({
  display_name: z.string().min(2, "Аты-жөні кемінде 2 таңба болуы керек.").max(160),
});

type ProfileValues = z.infer<typeof profileSchema>;

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Ағымдағы құпиясөзді енгізіңіз."),
    new_password: z
      .string()
      .min(8, "Жаңа құпиясөз кемінде 8 таңба болуы керек.")
      .regex(/[A-Za-zА-Яа-яӘәҒғҚқҢңӨөҰұҮүҺһІі]/, "Құпиясөзде әріп болуы керек.")
      .regex(/\d/, "Құпиясөзде цифр болуы керек."),
    confirm: z.string(),
  })
  .refine((values) => values.new_password === values.confirm, {
    message: "Құпиясөздер сәйкес келмейді.",
    path: ["confirm"],
  });

type PasswordValues = z.infer<typeof passwordSchema>;

export function AccountPage() {
  useTitle("Аккаунт");
  const { user, refreshMe, logout } = useAuth();
  const navigate = useNavigate();
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { display_name: user?.display_name ?? "" },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { current_password: "", new_password: "", confirm: "" },
  });

  if (!user) return null;

  async function saveProfile(values: ProfileValues) {
    setProfileError(null);
    setProfileMessage(null);
    try {
      await http.patch<Me>("/me", { display_name: values.display_name.trim() });
      await refreshMe();
      setProfileMessage("Профиль жаңартылды.");
    } catch (error) {
      setProfileError(errorMessage(error));
    }
  }

  async function savePassword(values: PasswordValues) {
    setPasswordError(null);
    setPasswordMessage(null);
    try {
      await http.post("/change-password", {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      setPasswordMessage("Құпиясөз жаңартылды. Қайта кіру қажет.");
      await logout();
      navigate("/login", { replace: true });
    } catch (error) {
      setPasswordError(errorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Аккаунт"
        title="Профиль және қауіпсіздік"
        description="Аты-жөнін өзгерту, құпиясөзді жаңарту және рөл/сынып ақпаратын қарау."
        actions={
          <LinkButton to={roleHome(user.role)} variant="secondary">
            Кабинетке оралу
          </LinkButton>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Профиль</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Email</dt>
              <dd className="font-semibold text-slate-800">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Рөл</dt>
              <dd className="font-semibold text-slate-800">{roleLabels[user.role]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Сыныптар</dt>
              <dd className="text-right font-semibold text-slate-800">
                {user.classrooms.length > 0
                  ? user.classrooms.map((item) => item.title).join(", ")
                  : "—"}
              </dd>
            </div>
          </dl>
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => void profileForm.handleSubmit(saveProfile)(event)}
          >
            <Field
              label="Аты-жөні"
              htmlFor="profile-name"
              required
              error={profileForm.formState.errors.display_name?.message}
            >
              <TextInput id="profile-name" {...profileForm.register("display_name")} />
            </Field>
            {profileMessage ? <Alert tone="success">{profileMessage}</Alert> : null}
            {profileError ? <Alert tone="error">{profileError}</Alert> : null}
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Сақтау
            </Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-bold text-ink-950">Құпиясөзді ауыстыру</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Құпиясөз ауысқаннан кейін барлық белсенді сессиялар жабылады.
          </p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(event) => void passwordForm.handleSubmit(savePassword)(event)}
          >
            <Field
              label="Ағымдағы құпиясөз"
              htmlFor="current-password"
              required
              error={passwordForm.formState.errors.current_password?.message}
            >
              <TextInput
                id="current-password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register("current_password")}
              />
            </Field>
            <Field
              label="Жаңа құпиясөз"
              htmlFor="new-password"
              required
              hint="Кемінде 8 таңба, әріп және цифр."
              error={passwordForm.formState.errors.new_password?.message}
            >
              <TextInput
                id="new-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("new_password")}
              />
            </Field>
            <Field
              label="Жаңа құпиясөзді қайталау"
              htmlFor="confirm-password"
              required
              error={passwordForm.formState.errors.confirm?.message}
            >
              <TextInput
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                {...passwordForm.register("confirm")}
              />
            </Field>
            {passwordMessage ? <Alert tone="success">{passwordMessage}</Alert> : null}
            {passwordError ? <Alert tone="error">{passwordError}</Alert> : null}
            <div className="flex gap-2">
              <Button type="submit" loading={passwordForm.formState.isSubmitting}>
                Құпиясөзді жаңарту
              </Button>
              <Button type="button" variant="ghost" onClick={() => void logout()}>
                Шығу
              </Button>
            </div>
          </form>
        </Card>
      </div>
      {user.must_change_password ? (
        <div className="mt-6">
          <Alert tone="warning" title="Уақытша құпиясөз">
            Әкімші берген уақытша құпиясөзбен кірдіңіз. Қауіпсіздік үшін құпиясөзді дереу
            ауыстырыңыз.
          </Alert>
        </div>
      ) : null}
    </div>
  );
}
