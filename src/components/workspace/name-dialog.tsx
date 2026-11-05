"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DISPLAY_NAME_MAX, validateDisplayName } from "@/lib/inquiry";

type NameDialogProps = {
  open: boolean;
  name: string;
  onClose: () => void;
  onSave: (name: string) => void;
};

export function NameDialog({ open, name, onClose, onSave }: NameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>{open && <NameForm name={name} onClose={onClose} onSave={onSave} />}</DialogContent>
    </Dialog>
  );
}

function NameForm({ name, onClose, onSave }: Omit<NameDialogProps, "open">) {
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateDisplayName(value);
    setError(found);
    if (found) return;
    onSave(value.trim());
    onClose();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>이름 설정</DialogTitle>
        <DialogDescription>멤버 목록과 함께 편집, 답글에 보이는 이름입니다.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">이름</Label>
        <Input
          id="display-name"
          value={value}
          maxLength={DISPLAY_NAME_MAX}
          aria-invalid={Boolean(error)}
          onChange={(event) => setValue(event.target.value)}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>취소</Button>
        <Button type="submit" className="chamfer rounded-none">저장</Button>
      </DialogFooter>
    </form>
  );
}
