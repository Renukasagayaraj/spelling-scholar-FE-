import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: null as null | { id: string },
  fetchCustomLists: vi.fn(), importCustomWordList: vi.fn(), importCustomWordFile: vi.fn(), fetchCustomListWords: vi.fn(),
  fetchForeignOrigins: vi.fn(), fetchForeignOriginDetails: vi.fn(),
}));

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({
  user: mocks.user, loading: false, configured: true,
  signInWithPassword: vi.fn(), signUpWithPassword: vi.fn(), signInWithGoogle: vi.fn(), signInWithFacebook: vi.fn(),
}) }));
vi.mock("@/lib/api", () => {
  class UnauthorizedError extends Error {}
  return { ...mocks, UnauthorizedError };
});

import { CustomListPanel } from "@/components/CustomListPanel";
import { ForeignOriginPanel } from "@/components/ForeignOriginPanel";

const word = { word: "rhythm", level: "2", gradeBand: "3-5", difficulty: "medium", origin: "Greek", definition: "Pattern", exampleSentence: "Keep rhythm", partOfSpeech: "noun", pronunciation: "rhythm", patterns: [] };

describe("practice source panels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = null;
    mocks.fetchCustomLists.mockResolvedValue({ lists: [] });
    mocks.fetchCustomListWords.mockResolvedValue([word]);
    mocks.fetchForeignOrigins.mockResolvedValue({ origins: [] });
    mocks.fetchForeignOriginDetails.mockResolvedValue({ origin: "Greek", wordCount: 1, words: [word] });
  });

  it("gates custom lists for signed-out users", () => {
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);
    expect(screen.getByText(/Sign in to view and practice/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("loads, expands, caches, selects, and practices custom lists", async () => {
    mocks.user = { id: "user" };
    const list = { id: "list-1", name: "Homework", level: "2", wordCount: 1 };
    mocks.fetchCustomLists.mockResolvedValue({ lists: [list] });
    const select = vi.fn();
    const start = vi.fn();
    render(<CustomListPanel selectedList={list} onSelectList={select} onStartPractice={start} />);
    expect(await screen.findByText("Homework")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Homework/ }));
    expect(await screen.findByText("rhythm")).toBeInTheDocument();
    expect(select).toHaveBeenCalledWith(list);
    fireEvent.click(screen.getByRole("button", { name: /Practice "Homework"/ }));
    expect(start).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /Homework/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Homework/ }));
    expect(mocks.fetchCustomListWords).toHaveBeenCalledTimes(1);
  });

  it("supports the legacy object-shaped custom-list word response", async () => {
    mocks.user = { id: "user" };
    const list = { id: "legacy", name: "Legacy List", level: "2", wordCount: 1 };
    mocks.fetchCustomLists.mockResolvedValue({ lists: [list] });
    mocks.fetchCustomListWords.mockResolvedValue({ words: [word] });
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);

    fireEvent.click(await screen.findByRole("button", { name: /Legacy List/ }));
    expect(await screen.findByText("rhythm")).toBeInTheDocument();
  });

  it("imports normalized custom words and reports success", async () => {
    mocks.user = { id: "user" };
    mocks.importCustomWordList.mockResolvedValue({
      list: { id: "new", name: "Wind Words", level: "2", wordCount: 2 },
      importedCount: 2, skippedExistingCount: 0, words: [word],
    });
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Import New List/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Wind Words"), { target: { value: " Wind Words " } });
    fireEvent.change(screen.getByPlaceholderText(/zephyrette/), { target: { value: " Rhythm, FRIEND\n\n" } });
    fireEvent.click(screen.getByRole("button", { name: "Import List" }));
    await waitFor(() => expect(mocks.importCustomWordList).toHaveBeenCalledWith({ listName: "Wind Words", words: ["rhythm", "friend"], overwriteList: true }));
    expect(await screen.findByText(/List "Wind Words" imported/)).toBeInTheDocument();
  });

  it("accepts only text and CSV files before starting a file import", async () => {
    mocks.user = { id: "user" };
    mocks.importCustomWordFile.mockResolvedValue({
      list: { id: "file-list", name: "Weekly Words", level: "custom", wordCount: 2 },
      importedCount: 2, skippedExistingCount: 1, words: [word],
    });
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);

    const input = await screen.findByLabelText("Choose word list file");
    expect(input).toHaveAttribute("accept", ".txt,.csv");

    fireEvent.change(input, { target: { files: [new File(["rhythm"], "words.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Please select a .txt or .csv file");
    expect(mocks.importCustomWordFile).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { files: [new File(["rhythm\nfriend\nrhythm"], "words.TXT", { type: "text/plain" })] } });
    await waitFor(() => expect(mocks.importCustomWordFile).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/File imported as "Weekly Words"/)).toBeInTheDocument();
    expect(screen.getByText("2 imported · 1 skipped")).toBeInTheDocument();
  });

  it("shows list and import failures", async () => {
    mocks.user = { id: "user" };
    mocks.fetchCustomLists.mockRejectedValue(new Error("offline"));
    mocks.importCustomWordList.mockRejectedValue(new Error("offline"));
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);
    expect(await screen.findByText("Could not load custom lists.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Import New List/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Wind Words"), { target: { value: "List" } });
    fireEvent.change(screen.getByPlaceholderText(/zephyrette/), { target: { value: "word" } });
    fireEvent.click(screen.getByRole("button", { name: "Import List" }));
    expect(await screen.findByText("Import failed. Please try again.")).toBeInTheDocument();
  });

  it("shows a file import network failure as a clear error message", async () => {
    mocks.user = { id: "user" };
    mocks.importCustomWordFile.mockRejectedValue(new Error("Network error during file upload."));
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);

    const input = await screen.findByLabelText("Choose word list file");
    fireEvent.change(input, { target: { files: [new File(["friend"], "words.txt", { type: "text/plain" })] } });

    expect(await screen.findByRole("alert")).toHaveTextContent("Network error during file upload.");
  });

  it("disables the Import File button and shows a spinner while a file import is in progress", async () => {
    mocks.user = { id: "user" };
    mocks.importCustomWordFile.mockReturnValue(new Promise(() => {}));
    render(<CustomListPanel selectedList={null} onSelectList={vi.fn()} onStartPractice={vi.fn()} />);

    const input = await screen.findByLabelText("Choose word list file");
    fireEvent.change(input, { target: { files: [new File(["friend"], "words.txt", { type: "text/plain" })] } });

    const importButton = await screen.findByRole("button", { name: /Importing/ });
    expect(importButton).toBeDisabled();
  });

  it("loads, expands, caches, and starts foreign-origin practice", async () => {
    const origin = { origin: "Greek", wordCount: 20 };
    mocks.fetchForeignOrigins.mockResolvedValue({ origins: [origin] });
    mocks.fetchForeignOriginDetails.mockResolvedValue({ origin: "Greek", wordCount: 20, words: Array.from({ length: 16 }, (_, i) => ({ ...word, word: `word${i}` })) });
    const select = vi.fn();
    const details = vi.fn();
    const start = vi.fn();
    render(<ForeignOriginPanel selectedOrigin={origin} onSelectOrigin={select} onDetailsLoaded={details} onStartPractice={start} />);
    fireEvent.click(await screen.findByRole("button", { name: /Greek/ }));
    expect(await screen.findByText(/Preview: 15 of 20/)).toBeInTheDocument();
    expect(screen.getByText(/word0.*word14/)).toHaveTextContent("…");
    fireEvent.click(screen.getByRole("button", { name: "Start Greek Practice" }));
    expect(start).toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /Greek/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Greek/ }));
    expect(mocks.fetchForeignOriginDetails).toHaveBeenCalledTimes(1);
    expect(details).toHaveBeenCalled();
  });

  it("shows empty and failed foreign-origin states", async () => {
    const { unmount } = render(<ForeignOriginPanel selectedOrigin={null} onSelectOrigin={vi.fn()} onStartPractice={vi.fn()} />);
    expect(await screen.findByText("No origins available.")).toBeInTheDocument();
    unmount();
    mocks.fetchForeignOrigins.mockRejectedValue(new Error("offline"));
    render(<ForeignOriginPanel selectedOrigin={null} onSelectOrigin={vi.fn()} onStartPractice={vi.fn()} />);
    expect(await screen.findByText("Could not load language origins.")).toBeInTheDocument();
  });
});
