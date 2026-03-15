export default function SportSite({ params }: { params: { sport: string } }) {
  const { sport } = params;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col items-center justify-center">
      <h1 className="text-5xl font-bold capitalize mb-4">{sport} Portal</h1>
      <p className="mb-6">This is the dedicated site for {sport}. Customize content here.</p>
      <a href="/" className="text-blue-600 underline">Back to control room</a>
    </div>
  );
}
