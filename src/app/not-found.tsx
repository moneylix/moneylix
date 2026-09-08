export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center max-w-md">
        <div className="w-24 h-24 mx-auto mb-6 bg-slate-800 rounded-2xl flex items-center justify-center">
          <h1 className="text-4xl font-bold text-accent">404</h1>
        </div>
        <h1 className="text-3xl font-bold text-white mb-4">Page Not Found</h1>
        <p className="text-slate-400 mb-8">The page you're looking for doesn't exist.</p>
        <a href="/" className="btn btn-primary">
          Go Home
        </a>
      </div>
    </div>
  )
}
