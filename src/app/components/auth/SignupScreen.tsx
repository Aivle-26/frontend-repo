import { useState } from "react";
import { Briefcase, CheckCircle2, Eye, EyeOff, UserRound } from "lucide-react";
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

interface SignupScreenProps {
  /** 로그인 화면으로 돌아가기 */
  onBackToLogin: () => void;
}

interface SignupForm {
  name: string;
  employeeNumber: string;
  email: string;
  department: string;
  password: string;
  passwordConfirm: string;
}

type FormErrors = Partial<Record<keyof SignupForm | "agreed", string>>;

const EMPTY_FORM: SignupForm = {
  name: "",
  employeeNumber: "",
  email: "",
  department: "",
  password: "",
  passwordConfirm: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: SignupForm, agreed: boolean): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = "이름을 입력해 주세요.";
  }

  if (!form.employeeNumber.trim()) {
    errors.employeeNumber = "사번을 입력해 주세요.";
  }

  if (!form.email.trim()) {
    errors.email = "이메일을 입력해 주세요.";
  } else if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "이메일 형식이 올바르지 않습니다.";
  }

  if (!form.password) {
    errors.password = "비밀번호를 입력해 주세요.";
  } else if (form.password.length < 8) {
    errors.password = "비밀번호는 8자 이상이어야 합니다.";
  }

  if (form.passwordConfirm !== form.password) {
    errors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
  }

  if (!agreed) {
    errors.agreed = "약관에 동의해 주세요.";
  }

  return errors;
}

export function SignupScreen({ onBackToLogin }: SignupScreenProps) {
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [role, setRole] = useState<Role>("pm");
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const update =
    (field: keyof SignupForm) => (event: React.ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
    };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors = validate(form, agreed);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // TODO: 백엔드 연동 시 authApi.signup(...) 호출로 교체
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <AuthShell title="가입 신청 완료" subtitle="관리자 승인 후 이용할 수 있습니다">
        <div className="space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#eef4ff]">
            <CheckCircle2 className="size-7 text-[#2F6FF2]" />
          </div>
          <p className="text-[15px] leading-7 text-slate-600">
            <span className="font-semibold text-slate-900">{form.name}</span>님의 가입
            신청이 접수되었습니다.
            <br />
            승인 결과는 <span className="font-semibold">{form.email}</span> 로
            안내드립니다.
          </p>
          <PrimaryButton type="button" onClick={onBackToLogin}>
            로그인 화면으로
          </PrimaryButton>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="회원가입"
      subtitle="AI 기반 RFP 프로젝트 관리"
      footer={
        <p className="text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <button
            type="button"
            onClick={onBackToLogin}
            className="font-semibold text-[#2F6FF2] transition-opacity hover:opacity-80"
          >
            로그인
          </button>
        </p>
      }
    >
      <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FormField label="이름" error={errors.name}>
            <Input
              id="name"
              placeholder="홍길동"
              value={form.name}
              onChange={update("name")}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </FormField>

          <FormField label="사번" error={errors.employeeNumber}>
            <Input
              id="employeeNumber"
              placeholder="PM-0001"
              value={form.employeeNumber}
              onChange={update("employeeNumber")}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
            />
          </FormField>
        </div>

        <FormField label="회사 이메일" error={errors.email}>
          <Input
            id="email"
            type="email"
            placeholder={EMAIL_EXAMPLE}
            value={form.email}
            onChange={update("email")}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </FormField>

        <FormField label="부서 (선택)">
          <Input
            id="department"
            placeholder="사업기획팀"
            value={form.department}
            onChange={update("department")}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </FormField>

        <FormField label="비밀번호" error={errors.password}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="8자 이상 입력해 주세요"
              value={form.password}
              onChange={update("password")}
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

        <FormField label="비밀번호 확인" error={errors.passwordConfirm}>
          <Input
            id="passwordConfirm"
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호를 다시 입력해 주세요"
            value={form.passwordConfirm}
            onChange={update("passwordConfirm")}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
          />
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

        <div className="space-y-1.5 pt-0.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-[14px] leading-6 text-slate-600">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(event) => {
                setAgreed(event.target.checked);
                setErrors((current) => ({ ...current, agreed: undefined }));
              }}
              className="mt-1 size-4 shrink-0 rounded border-slate-300 accent-[#2F6FF2]"
            />
            <span>
              서비스 이용약관 및 개인정보 처리방침에 동의합니다.{" "}
              <span className="text-[#2F6FF2]">(필수)</span>
            </span>
          </label>
          {errors.agreed ? (
            <p className="text-[13px] text-rose-600">{errors.agreed}</p>
          ) : null}
        </div>

        <div className="pt-1">
          <PrimaryButton>가입 신청</PrimaryButton>
        </div>
      </form>
    </AuthShell>
  );
}
