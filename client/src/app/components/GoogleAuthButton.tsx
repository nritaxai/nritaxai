import { GoogleLogin } from "@react-oauth/google";

type GoogleAuthButtonProps = {
  text: "signin_with" | "signup_with";
  disabled?: boolean;
  onBlockedClick?: () => void;
  onSuccess: (credentialResponse: { credential?: string }) => void;
  onError: () => void;
};

export function GoogleAuthButton({
  text,
  disabled = false,
  onBlockedClick,
  onSuccess,
  onError,
}: GoogleAuthButtonProps) {
  return (
    <div className="relative flex w-full justify-center">
      {disabled ? (
        <button
          type="button"
          className="absolute inset-0 z-10 cursor-pointer rounded-xl"
          aria-label="Complete required fields before Google authentication"
          onClick={onBlockedClick}
        />
      ) : null}

      <div className="w-full overflow-hidden rounded-xl border border-slate-300 bg-white p-1 shadow-none [&>div]:!w-full [&>div>div]:!w-full">
        <GoogleLogin
          text={text}
          theme="outline"
          shape="rectangular"
          size="large"
          width="380"
          logo_alignment="left"
          onSuccess={onSuccess}
          onError={onError}
        />
      </div>
    </div>
  );
}
