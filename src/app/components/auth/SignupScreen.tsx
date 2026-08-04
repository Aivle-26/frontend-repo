import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type UIEvent,
} from "react";
import { Briefcase, Eye, EyeOff, UserRound } from "lucide-react";
import {
  ApiError,
  projectRepository,
  type Role,
  type SignupRequest,
} from "@/app/api/projectRepository";
import { Alert, AlertDescription } from "@/app/components/ui/alert";
import { Checkbox } from "@/app/components/ui/checkbox";
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
import {
  AGREEMENT_CONTENT,
  AgreementModal,
} from "@/app/components/auth/AgreementModal";

interface SignupScreenProps {
  onBackToLogin: (options?: { email?: string; message?: string }) => void;
}

interface SignupForm {
  employeeNumber: string;
  name: string;
  email: string;
  password: string;
  passwordConfirm: string;
  verificationCode: string;
}

type FormErrors = Partial<Record<keyof SignupForm, string>>;
type SignupStep = "details" | "verification";
type AgreementType = "terms" | "privacy";

const EMPTY_FORM: SignupForm = {
  employeeNumber: "",
  name: "",
  email: "",
  password: "",
  passwordConfirm: "",
  verificationCode: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

function toApiRole(role: Role): SignupRequest["role"] {
  return role === "pm" ? "PM" : "STAFF";
}

function validate(form: SignupForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.employeeNumber.trim()) {
    errors.employeeNumber = "사번을 입력해 주세요.";
  }

  if (!form.name.trim()) {
    errors.name = "이름을 입력해 주세요.";
  }

  if (!form.email.trim()) {
    errors.email = "이메일을 입력해 주세요.";
  } else if (!EMAIL_PATTERN.test(form.email.trim())) {
    errors.email = "이메일 형식이 올바르지 않습니다.";
  }

  if (!form.password) {
    errors.password = "비밀번호를 입력해 주세요.";
  } else if (!PASSWORD_PATTERN.test(form.password)) {
    errors.password = "비밀번호는 8~72자이며 영문과 숫자를 포함해야 합니다.";
  }

  if (!form.passwordConfirm) {
    errors.passwordConfirm = "비밀번호 확인을 입력해 주세요.";
  } else if (form.passwordConfirm !== form.password) {
    errors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
  }

  return errors;
}

export function SignupScreen({ onBackToLogin }: SignupScreenProps) {
  const [form, setForm] = useState<SignupForm>(EMPTY_FORM);
  const [role, setRole] = useState<Role>("pm");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<SignupStep>("details");
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [agreementModalOpen, setAgreementModalOpen] = useState(false);
  const [activeAgreement, setActiveAgreement] = useState<AgreementType | null>(
    null,
  );
  const [hasReachedBottom, setHasReachedBottom] = useState(false);
  const agreementScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!agreementModalOpen || !activeAgreement) return;

    setHasReachedBottom(false);
    const frame = window.requestAnimationFrame(() => {
      const element = agreementScrollRef.current;
      if (!element) return;

      element.scrollTop = 0;
      if (element.scrollHeight <= element.clientHeight + 4) {
        setHasReachedBottom(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [agreementModalOpen, activeAgreement]);

  const closeAgreementModal = () => {
    setAgreementModalOpen(false);
    setActiveAgreement(null);
    setHasReachedBottom(false);
  };

  const openAgreementModal = (type: AgreementType) => {
    setActiveAgreement(type);
    setHasReachedBottom(false);
    setAgreementModalOpen(true);
  };

  const handleAgreementClick = (type: AgreementType) => {
    setErrorMessage("");

    if (type === "terms" && termsAgreed) {
      setTermsAgreed(false);
      return;
    }

    if (type === "privacy" && privacyAcknowledged) {
      setPrivacyAcknowledged(false);
      return;
    }

    openAgreementModal(type);
  };

  const handleAgreementScroll = (event: UIEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const reachedBottom =
      element.scrollTop + element.clientHeight >= element.scrollHeight - 4;

    if (reachedBottom) {
      setHasReachedBottom(true);
    }
  };

  const handleAgree = () => {
    if (!hasReachedBottom || !activeAgreement) return;

    if (activeAgreement === "terms") {
      setTermsAgreed(true);
    } else {
      setPrivacyAcknowledged(true);
    }

    closeAgreementModal();
  };

  const update =
    (field: keyof SignupForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setForm((current) => ({ ...current, [field]: event.target.value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setMessage("");
      setErrorMessage("");
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (step === "verification") {
      await handleVerifySignup();
      return;
    }

    if (!termsAgreed || !privacyAcknowledged) {
      setErrorMessage("필수 동의 항목을 모두 확인해 주세요.");
      return;
    }

    const normalizedForm: SignupForm = {
      ...form,
      employeeNumber: form.employeeNumber.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
    };

    const nextErrors = validate(normalizedForm);
    setErrors(nextErrors);
    setMessage("");
    setErrorMessage("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      await projectRepository.signup({
        employeeNumber: normalizedForm.employeeNumber,
        name: normalizedForm.name,
        email: normalizedForm.email,
        password: normalizedForm.password,
        role: toApiRole(role),
      });

      setForm((current) => ({
        ...current,
        employeeNumber: normalizedForm.employeeNumber,
        name: normalizedForm.name,
        email: normalizedForm.email,
        password: normalizedForm.password,
        passwordConfirm: normalizedForm.passwordConfirm,
        verificationCode: "",
      }));
      setStep("verification");
      setMessage("이메일로 발송된 6자리 인증번호를 입력해 주세요.");
    } catch (caught) {
      setErrorMessage(getSignupError(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignup = async () => {
    const verificationCode = form.verificationCode.trim();
    setMessage("");
    setErrorMessage("");

    if (!/^\d{6}$/.test(verificationCode)) {
      setErrors((current) => ({
        ...current,
        verificationCode: "6자리 인증번호를 입력해 주세요.",
      }));
      return;
    }

    setIsSubmitting(true);

    try {
      await projectRepository.verifySignup({
        email: form.email.trim(),
        verificationCode,
      });
      setForm(EMPTY_FORM);
      setStep("details");
      onBackToLogin({
        email: form.email.trim(),
        message: "회원가입이 완료되었습니다. 로그인해주세요.",
      });
    } catch (caught) {
      setErrorMessage(getSignupError(caught));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDetails = () => {
    setStep("details");
    setMessage("");
    setErrorMessage("");
    setErrors({});
    setForm((current) => ({ ...current, verificationCode: "" }));
  };

  const isVerificationStep = step === "verification";
  const isConsentComplete = termsAgreed && privacyAcknowledged;
  const activeAgreementContent = activeAgreement
    ? AGREEMENT_CONTENT[activeAgreement]
    : AGREEMENT_CONTENT.terms;

  return (
    <AuthShell
      title="회원가입"
      subtitle="AI 기반 RFP 프로젝트 관리"
      footer={
        <p className="text-center text-sm text-slate-500">
          이미 계정이 있으신가요?{" "}
          <button
            type="button"
            onClick={() => onBackToLogin()}
            className="font-semibold text-[#2F6FF2] transition-opacity hover:opacity-80"
          >
            로그인
          </button>
        </p>
      }
    >
      <>
        <form className="space-y-3.5" onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <FormField label="사번" error={errors.employeeNumber}>
            <Input
              id="employeeNumber"
              placeholder="PM100"
              value={form.employeeNumber}
              onChange={update("employeeNumber")}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
              disabled={isVerificationStep || isSubmitting}
            />
          </FormField>

          <FormField label="이름" error={errors.name}>
            <Input
              id="name"
              placeholder="홍길동"
              value={form.name}
              onChange={update("name")}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
              disabled={isVerificationStep || isSubmitting}
            />
          </FormField>
        </div>

        <FormField label="이메일" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={EMAIL_EXAMPLE}
            value={form.email}
            onChange={update("email")}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            disabled={isVerificationStep || isSubmitting}
          />
        </FormField>

        <FormField label="비밀번호" error={errors.password}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="영문과 숫자를 포함해 8~72자"
              value={form.password}
              onChange={update("password")}
              className={cn(INPUT_CLASS, "pr-11")}
              style={INPUT_STYLE}
              disabled={isVerificationStep || isSubmitting}
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

        <FormField label="비밀번호 확인" error={errors.passwordConfirm}>
          <Input
            id="passwordConfirm"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="비밀번호를 다시 입력해 주세요"
            value={form.passwordConfirm}
            onChange={update("passwordConfirm")}
            className={INPUT_CLASS}
            style={INPUT_STYLE}
            disabled={isVerificationStep || isSubmitting}
          />
        </FormField>

        <FormField label="역할 선택">
          <div className="mx-auto grid w-full max-w-[288px] grid-cols-1 gap-6 sm:grid-cols-2">
            <RoleCard
              active={role === "pm"}
              disabled={isVerificationStep || isSubmitting}
              onClick={() => setRole("pm")}
              icon={<Briefcase className="size-4" />}
              title="PM"
            />
            <RoleCard
              active={role === "staff"}
              disabled={isVerificationStep || isSubmitting}
              onClick={() => setRole("staff")}
              icon={<UserRound className="size-4" />}
              title="STAFF"
            />
          </div>
        </FormField>

        {!isVerificationStep ? (
          <div className="space-y-2.5" aria-label="필수 동의 항목">
            <div className="group flex w-fit max-w-full items-start gap-2.5 text-sm leading-5 text-slate-700">
              <Checkbox
                id="termsAgreed"
                type="button"
                checked={termsAgreed}
                onCheckedChange={() => handleAgreementClick("terms")}
                aria-labelledby="termsAgreementLabel"
                className="mt-0.5 border-slate-300 transition-colors data-[state=checked]:border-[#5B84DC] data-[state=checked]:bg-[#5B84DC] group-hover:data-[state=unchecked]:border-[#7EA1EC] group-hover:data-[state=unchecked]:bg-[#F3F7FF] group-hover:data-[state=checked]:border-[#6C92E4] group-hover:data-[state=checked]:bg-[#6C92E4]"
                disabled={isSubmitting}
              />
              <button
                id="termsAgreementLabel"
                type="button"
                onClick={() => handleAgreementClick("terms")}
                className="text-left transition-colors group-hover:text-[#5B84DC] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
              >
                <span className="font-semibold text-[#5B84DC]">[필수]</span>{" "}
                PM Agent 서비스 이용약관 동의
              </button>
            </div>

            <div className="group flex w-fit max-w-full items-start gap-2.5 text-sm leading-5 text-slate-700">
              <Checkbox
                id="privacyAcknowledged"
                type="button"
                checked={privacyAcknowledged}
                onCheckedChange={() => handleAgreementClick("privacy")}
                aria-labelledby="privacyAgreementLabel"
                className="mt-0.5 border-slate-300 transition-colors data-[state=checked]:border-[#5B84DC] data-[state=checked]:bg-[#5B84DC] group-hover:data-[state=unchecked]:border-[#7EA1EC] group-hover:data-[state=unchecked]:bg-[#F3F7FF] group-hover:data-[state=checked]:border-[#6C92E4] group-hover:data-[state=checked]:bg-[#6C92E4]"
                disabled={isSubmitting}
              />
              <button
                id="privacyAgreementLabel"
                type="button"
                onClick={() => handleAgreementClick("privacy")}
                className="text-left transition-colors group-hover:text-[#5B84DC] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
              >
                <span className="font-semibold text-[#5B84DC]">[필수]</span>{" "}
                개인정보 수집·이용 안내 확인
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-400">
              필수 항목을 모두 확인해야 인증메일을 보낼 수 있습니다.
            </p>
          </div>
        ) : null}

        {isVerificationStep ? (
          <FormField label="이메일 인증번호" error={errors.verificationCode}>
            <Input
              id="signupVerificationCode"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="6자리 인증번호"
              value={form.verificationCode}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");
                setForm((current) => ({ ...current, verificationCode: value }));
                setErrors((current) => ({ ...current, verificationCode: undefined }));
                setMessage("");
                setErrorMessage("");
              }}
              className={INPUT_CLASS}
              style={INPUT_STYLE}
              disabled={isSubmitting}
            />
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-[#2F6FF2] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSubmitting}
              onClick={handleEditDetails}
            >
              회원가입 정보 수정
            </button>
          </FormField>
        ) : null}

        {message ? (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <div className="pt-1">
          <PrimaryButton
            disabled={
              isSubmitting || (!isVerificationStep && !isConsentComplete)
            }
          >
            {isSubmitting
              ? isVerificationStep
                ? "인증 확인 중..."
                : "인증번호 발송 중..."
              : isVerificationStep
                ? "인증 후 회원가입 완료"
                : "인증번호 받기"}
          </PrimaryButton>
        </div>
        </form>

        <AgreementModal
          open={agreementModalOpen}
          content={activeAgreementContent}
          hasReachedBottom={hasReachedBottom}
          scrollContainerRef={agreementScrollRef}
          onScroll={handleAgreementScroll}
          onAgree={handleAgree}
          onClose={closeAgreementModal}
        />
      </>
    </AuthShell>
  );
}

function getSignupError(caught: unknown) {
  if (caught instanceof ApiError) {
    return caught.message || "회원가입에 실패했습니다.";
  }

  return "네트워크 오류가 발생했습니다. 다시 시도해 주세요.";
}
