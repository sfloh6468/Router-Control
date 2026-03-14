import React from "react";
import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <ShieldAlert className="h-24 w-24 text-destructive/50" />
        </div>
        <div>
          <h1 className="text-4xl font-bold text-foreground">404</h1>
          <p className="text-muted-foreground mt-2 text-lg">Page not found or unroutable destination.</p>
        </div>
        <Link href="/">
          <Button variant="default" size="lg">
            Return to Gateway
          </Button>
        </Link>
      </div>
    </div>
  );
}
