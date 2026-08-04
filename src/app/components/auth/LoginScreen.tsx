import { useState, type FormEvent } from "react";
import { Briefcase, Eye, EyeOff, UserRound } from "lucide-react";
import {
  ApiError,
  projectRepository,
  type LoginVerifyResponse,
  type Role,
} from "@/app/api/projectRepository";
import { Input } from "@/app/components/ui/input";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import {
  AuthShell,
  EMAIL_EXAMPLE,
  FormField,
  INPUT_CLASS,
  INPUT_STYLE,
  PrimaryButton,
  RoleCard,
} from "@/app/components/auth/authShared";
import { cn } from "@/app/components/ui/utils";

interface LoginScreenProps {
  onLogin: (session: LoginVerifyResponse) => void;
  onSignupClick: () => void;
  initialEmail?: string;
  initialMessage?: string;
}

function toApiRole(role: Role) {
  return role === "pm" ? "PM" : "STAFF";
}

export function LoginScreen({
  onLogin,
  onSignupClick,
  initialEmail = "",
  initialMessage = "",
}: LoginScreenProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("pm");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError("");
    setMessage("");

    setIsSubmitting(true);

    try {
      const response = await projectRepository.login({
        email: email.trim(),
        password,
        role: toApiRole(role),
      });

      if (!response.accessToken?.trim()) {
        throw new ApiError(401, "로그인에 실패했습니다.");
      }

      onLogin(response);
    } catch (caught) {
      setError(getLoginError(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="로그인"
      subtitle="AI 기반 RFP 프로젝트 관리"
      footer={
        <p className="text-center text-sm text-slate-500">
          아직 계정이 없으신가요?{" "}
          <button
            type="button"
            onClick={onSignupClick}
            className="font-semibold text-[#2F6FF2] transition-opacity hover:opacity-80"
          >
            회원가입
          </button>
        </p>
      }
    >
      <form className="space-y-3.5" onSubmit={handleSubmit}>
        <FormField label="이메일">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={EMAIL_EXAMPLE}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isSubmitting}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            required
          />
        </FormField>

        <FormField label="비밀번호">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="비밀번호를 입력해 주세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSubmitting}
              className={cn(INPUT_CLASS, "pr-11")}
              style={INPUT_STYLE}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              disabled={isSubmitting}
            >
              {showPassword ? (
                <EyeOff className="size-4.5" />
              ) : (
                <Eye className="size-4.5" />
              )}
            </button>
          </div>
        </FormField>

        <FormField label="역할 선택">
          <div className="mx-auto grid w-full max-w-[288px] grid-cols-1 gap-6 sm:grid-cols-2">
            <RoleCard
              active={role === "pm"}
              disabled={isSubmitting}
              onClick={() => setRole("pm")}
              icon={<Briefcase className="size-4" />}
              title="PM"
            />
            <RoleCard
              active={role === "staff"}
              disabled={isSubmitting}
              onClick={() => setRole("staff")}
              icon={<UserRound className="size-4" />}
              title="STAFF"
            />
          </div>
        </FormField>

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2 pt-0.5">
          <PrimaryButton disabled={isSubmitting}>
            {isSubmitting ? "로그인 중..." : "로그인"}
          </PrimaryButton>
        </div>
      </form>
    </AuthShell>
  );
}

function getLoginError(caught: unknown) {
  if (caught instanceof ApiError) {
    return caught.message || "로그인 요청에 실패했습니다.";
  }

  return "네트워크 오류가 발생했습니다. 다시 시도해 주세요.";
}
