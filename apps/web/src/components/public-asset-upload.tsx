import { useRef, useState } from "react";
import { ImageIcon, Upload, X } from "lucide-react";
import type { CreatePublicAssetUploadRequest } from "@workspace/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { uploadPublicAsset } from "@/lib/assets";

type PublicAssetUploadProps = {
  label: string;
  value: string | null;
  kind: CreatePublicAssetUploadRequest["kind"];
  role?: CreatePublicAssetUploadRequest["role"];
  eventId?: string | null;
  disabled?: boolean;
  onChange: (url: string | null) => void;
  onUploaded?: (asset: Awaited<ReturnType<typeof uploadPublicAsset>>) => void;
  onError: (message: string) => void;
};

export function PublicAssetUpload({
  label,
  value,
  kind,
  role,
  eventId,
  disabled,
  onChange,
  onUploaded,
  onError,
}: PublicAssetUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const chooseFile = () => inputRef.current?.click();

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    onError("");

    try {
      const asset = await uploadPublicAsset({ file, kind, role, eventId });
      onChange(asset.publicUrl);
      onUploaded?.(asset);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Unable to upload image");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 sm:flex-row sm:items-center">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{value ? "Image uploaded" : "No image"}</p>
          <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP, or GIF.</p>
          <Input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={(event) => void uploadFile(event.target.files?.[0])}
          />
        </div>
        <div className="flex gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={disabled || uploading}
            onClick={chooseFile}
          >
            <Upload className="size-3.5" />
            {uploading ? "Uploading..." : value ? "Replace" : "Upload"}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={disabled || uploading}
              onClick={() => onChange(null)}
            >
              <X className="size-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
