import React from "react";

export const RateSkeleton = () => (
  <div className="flex flex-col p-2.5 rounded-2xl skeleton-pulse -m-2.5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-white/5" />
        <div className="w-16 h-3 bg-white/5 rounded-full" />
      </div>
      <div className="w-10 h-3 bg-white/5 rounded-full" />
    </div>
    <div className="flex items-center gap-2 mb-3">
      <div className="w-24 h-8 bg-white/5 rounded-xl" />
    </div>
    <div className="flex items-center justify-between gap-2">
      <div className="w-12 h-2 bg-white/5 rounded-full" />
      <div className="w-16 h-2 bg-white/5 rounded-full" />
    </div>
  </div>
);

export const SkeletonRates = () => (
  <div className="space-y-16">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-8 gap-y-12">
      {[...Array(10)].map((_, i) => <RateSkeleton key={i} />)}
    </div>
  </div>
);
