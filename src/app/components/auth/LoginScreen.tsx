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
import {
  LEGAL_DOCUMENT_LINKS,
  LegalDocumentModal,
  type LegalDocumentType,
} from "@/app/components/auth/LegalDocumentModal";

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
  const [legalDocument, setLegalDocument] =
    useState<LegalDocumentType | null>(null);

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
      subtitle=""
      mainClassName="py-8 sm:py-10"
      matchPanelHeight
      fitViewport
      footer={
        <div className="space-y-4">
          <p className="text-center text-base font-medium text-slate-600">
            아직 계정이 없으신가요?{" "}
            <button
              type="button"
              onClick={onSignupClick}
              className="font-semibold text-[#3A8FB6] transition-opacity hover:opacity-80"
            >
              회원가입
            </button>
          </p>

          <nav
            aria-label="정책 및 라이선스"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600"
          >
            {LEGAL_DOCUMENT_LINKS.map((document, index) => (
              <div key={document.label} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-slate-300">
                    |
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setLegalDocument(document.type)}
                  className="transition-colors hover:text-[#3A8FB6] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F9FD8]/25"
                >
                  {document.label}
                </button>
              </div>
            ))}
          </nav>
        </div>
      }
    >
      <>
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
            className={cn(INPUT_CLASS, "h-12 text-base")}
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
              className={cn(INPUT_CLASS, "h-12 pr-11 text-base")}
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

        <FormField label="로그인 유형">
          <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-white/90 to-sky-50/55 p-3.5 shadow-[0_8px_22px_rgba(30,93,125,0.05)]">
            <p className="mb-3 text-sm leading-5 text-slate-500">
              사용할 역할을 선택해 주세요.
            </p>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
              <RoleCard
                active={role === "pm"}
                disabled={isSubmitting}
                onClick={() => setRole("pm")}
                icon={<Briefcase className="size-4" />}
                title="PM"
                description="프로젝트 관리"
              />
              <RoleCard
                active={role === "staff"}
                disabled={isSubmitting}
                onClick={() => setRole("staff")}
                icon={<UserRound className="size-4" />}
                title="STAFF"
                description="배정 업무 수행"
              />
            </div>
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

        <LegalDocumentModal
          document={legalDocument}
          onClose={() => setLegalDocument(null)}
        />
      </>
    </AuthShell>
  );
}

function getLoginError(caught: unknown) {
  if (caught instanceof ApiError) {
    return caught.message || "로그인 요청에 실패했습니다.";
  }

  return "네트워크 오류가 발생했습니다. 다시 시도해 주세요.";
}
