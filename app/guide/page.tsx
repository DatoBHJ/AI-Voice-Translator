import Link from 'next/link';

export default function Guide() {
  return (
    <div className="min-h-screen bg-white p-8 flex flex-col items-center justify-center text-black">
      <div className="max-w-md text-center">
        <div className="space-y-8">
          <p className="text-[11px] tracking-[0.2em]  font-light">
            1. Name two languages
          </p>
          <p className="text-[11px] tracking-[0.2em]  font-light">
            2. Start speaking in either language
          </p>
          <p className="text-[11px] tracking-[0.2em]  font-light">
            3. Get instant translations
          </p>
        </div>
        <Link 
          href="/"
          className="text-[10px] tracking-[0.2em] transition-colors duration-200 block mt-48"
        >
          back
        </Link>
      </div>
    </div>
  );
} 