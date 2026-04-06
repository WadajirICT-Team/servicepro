import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export function TablePagination({ currentPage, totalItems, pageSize, onPageChange }: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems <= pageSize) return null;

  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        {from}–{to} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        <span className="text-sm px-3 text-muted-foreground font-medium">
          {currentPage} / {totalPages}
        </span>
        <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
