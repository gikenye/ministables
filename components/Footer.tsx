import Image from "next/image"

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2">
      <div className="flex justify-center items-center gap-8">
        <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Image src="/icons/home.svg" alt="Home" width={32} height={32} className="w-8 h-8" />
          <span className="text-xs text-gray-600">Home</span>
        </button>

        <button className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors">
          <Image src="/icons/dashboard.svg" alt="Dashboard" width={32} height={32} className="w-8 h-8" />
          <span className="text-xs text-gray-600">Dashboard</span>
        </button>
      </div>
    </footer>
  )
}
