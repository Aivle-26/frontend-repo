import { useState } from "react";
import { Briefcase, Eye, EyeOff, UserRound } from "lucide-react";
import type { StoredAuthSession } from "@/app/auth/authSession";
import type { Role } from "@/app/api/projectRepository";
import { Input } from "@/app/components/ui/input";
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
  onLogin: (session: StoredAuthSession) => void;
  /** 회원가입 화면으로 이동 */
  onSignupClick: () => void;
}

// 인증 없음. 선택한 역할로 세션 모양만 만들어 넘깁니다.
function createSession(role: Role): StoredAuthSession {
  const now = Date.now();
  return {
    employeeNumber: role === "pm" ? "PM-0001" : "ST-0001",
    name: role === "pm" ? "정하늘" : "나",
    role,
    accessToken: "",
    refreshToken: "",
    accessTokenExpiresAt: now + 60 * 60 * 1000,
    absoluteExpiresAt: now + 12 * 60 * 60 * 1000,
    lastActivityAt: now,
    serverTime: now,
    inactivityTimeoutMinutes: 60,
  };
}

export function LoginScreen({ onLogin, onSignupClick }: LoginScreenProps) {
  const [email, setEmail] = useState(EMAIL_EXAMPLE);
  const [password, setPassword] = useState("password");
  const [role, setRole] = useState<Role>("pm");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onLogin(createSession(role));
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
            placeholder={EMAIL_EXAMPLE}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </FormField>

        <FormField label="비밀번호">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="비밀번호를 입력해 주세요"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={cn(INPUT_CLASS, "pr-11")}
              style={INPUT_STYLE}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
              aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
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
              onClick={() => setRole("pm")}
              icon={<Briefcase className="size-4" />}
              title="PM"
              desc="공고 분석과 업무 배정, 진행 현황을 관리합니다."
            />
            <RoleCard
              active={role === "staff"}
              onClick={() => setRole("staff")}
              icon={<UserRound className="size-4" />}
              title="직원"
              desc="배정 업무를 확인하고 제출물과 피드백을 관리합니다."
            />
          </div>
        </FormField>

        <div className="pt-0.5">
          <PrimaryButton>로그인</PrimaryButton>
        </div>
      </form>
    </AuthShell>
  );
}
