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
}

type LoginStep = "credentials" | "verification";

function toApiRole(role: Role) {
  return role === "pm" ? "PM" : "STAFF";
}

export function LoginScreen({ onLogin, onSignupClick }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("pm");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<LoginStep>("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      if (step === "credentials") {
        const response = await projectRepository.login({
          email,
          password,
          role: toApiRole(role),
        });
        setMessage(response.message || "인증번호를 전송했습니다.");
        setStep("verification");
        return;
      }

      const response = await projectRepository.verifyLogin({
        email,
        verificationCode,
      });
      onLogin(response);
    } catch (caught) {
      setError(getLoginError(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await projectRepository.resendLoginVerification(email);
      setMessage(response.message || "인증번호를 다시 전송했습니다.");
    } catch (caught) {
      setError(getLoginError(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isVerificationStep = step === "verification";

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
            disabled={isVerificationStep || isSubmitting}
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
              disabled={isVerificationStep || isSubmitting}
              className={cn(INPUT_CLASS, "pr-11")}
              style={INPUT_STYLE}
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              disabled={isVerificationStep || isSubmitting}
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
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <RoleCard
              active={role === "pm"}
              disabled={isVerificationStep || isSubmitting}
              onClick={() => setRole("pm")}
              icon={<Briefcase className="size-4" />}
              title="PM"
              desc="공고 분석과 업무 배정, 진행 현황을 관리합니다."
            />
            <RoleCard
              active={role === "staff"}
              disabled={isVerificationStep || isSubmitting}
              onClick={() => setRole("staff")}
              icon={<UserRound className="size-4" />}
              title="직원"
              desc="배정 업무를 확인하고 제출물과 피드백을 관리합니다."
            />
          </div>
        </FormField>

        {isVerificationStep ? (
          <FormField label="인증번호">
            <Input
              id="verificationCode"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="6자리 인증번호"
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, ""))
              }
              disabled={isSubmitting}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
              required
            />
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-[#2F6FF2] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              onClick={handleResend}
            >
              인증번호 다시 받기
            </button>
          </FormField>
        ) : null}

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
            {isVerificationStep ? "인증 후 로그인" : "인증번호 요청"}
          </PrimaryButton>
          {isVerificationStep ? (
            <PrimaryButton
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setStep("credentials");
                setVerificationCode("");
                setError("");
                setMessage("");
              }}
            >
              로그인 정보 수정
            </PrimaryButton>
          ) : null}
        </div>
      </form>
    </AuthShell>
  );
}

function getLoginError(caught: unknown) {
  if (caught instanceof ApiError) {
    if (caught.status === 401) {
      return "이메일, 비밀번호, 역할 또는 인증번호를 확인해 주세요.";
    }
    if (caught.status === 403) {
      return "로그인 권한이 없습니다.";
    }
    if (caught.status === 429) {
      return "잠시 후 다시 인증번호를 요청해 주세요.";
    }
    return caught.message || "로그인 요청에 실패했습니다.";
  }

  return "네트워크 오류가 발생했습니다. 다시 시도해 주세요.";
}
