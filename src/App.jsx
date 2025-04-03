import React, { useState } from 'react';
import { format, addDays, startOfWeek, isBefore, setHours, setMinutes } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const meals = ['早', '中', '晚'];
const mealDeadlines = [6, 9, 14];

const MealPlanner = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [data, setData] = useState({});
  const [names, setNames] = useState([{ name: '', count: 1 }]);

  const startDay = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const handleCheck = (idx, day, meal) => {
    const key = `${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`;
    setData((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getMealCount = (day, meal) => {
    return names.reduce((sum, _, idx) => sum + (data[`${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`] ? names[idx].count : 0), 0);
  };

  const canCheck = (day, mealIdx) => {
    const deadline = setMinutes(setHours(day, mealDeadlines[mealIdx]), 0);
    return isBefore(new Date(), deadline);
  };

  const updateCount = (idx) => {
    const input = prompt("请输入用餐人数:", names[idx].count);
    const newCount = parseInt(input, 10);
    if (!isNaN(newCount) && newCount > 0) {
      setNames(names.map((item, i) => (i === idx ? { ...item, count: newCount } : item)));
    }
  };

  return (
    <div className="p-4 font-sans">
      <h2 className="text-2xl font-bold mb-4 text-center">升龙公司德合厂用餐计划表</h2>
      <div className="flex items-center justify-between mb-4">
        <ChevronLeft className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, -7))} />
        <span className="text-lg font-semibold">
          {format(startDay, 'dd/MM/yyyy')} - {format(addDays(startDay, 6), 'dd/MM/yyyy')}
        </span>
        <ChevronRight className="cursor-pointer" onClick={() => setCurrentWeek(addDays(currentWeek, 7))} />
      </div>

      <table className="w-full border-collapse text-center">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2" rowSpan={2}>姓名</th>
            <th className="border p-2" rowSpan={2}>用餐人数</th>
            {[...Array(7)].map((_, idx) => (
              <th key={idx} className="border p-1" colSpan={3}>
                {format(addDays(startDay, idx), 'dd/MM EEE', { locale: zhCN })}
              </th>
            ))}
          </tr>
          <tr className="bg-gray-200">
            {[...Array(7)].map((_, idx) => (
              meals.map(meal => (
                <th key={`${idx}-${meal}`} className="border p-1">{meal}</th>
              ))
            ))}
          </tr>
        </thead>
        <tbody>
          {names.map((user, idx) => (
            <tr key={idx}>
              <td className="border p-2">
                <input
                  className="w-full"
                  value={user.name}
                  placeholder="输入姓名"
                  onChange={(e) => {
                    const newNames = [...names];
                    newNames[idx].name = e.target.value;
                    setNames(newNames);
                  }}
                />
              </td>
              <td className="border p-2 cursor-pointer" onClick={() => updateCount(idx)}>
                {user.count}
              </td>
              {[...Array(7)].map((_, dayIdx) => (
                meals.map((meal, mealIdx) => {
                  const day = addDays(startDay, dayIdx);
                  return (
                    <td key={`${dayIdx}-${meal}`} className="border">
                      <input
                        type="checkbox"
                        disabled={!canCheck(day, mealIdx) || !user.name}
                        checked={data[`${idx}-${format(day, 'yyyy-MM-dd')}-${meal}`] || false}
                        onChange={() => handleCheck(idx, day, meal)}
                      />
                    </td>
                  );
                })
              ))}
            </tr>
          ))}
          <tr>
            <td className="border p-2 font-bold" colSpan={2}>合计人数</td>
            {[...Array(7)].map((_, dayIdx) => (
              meals.map((meal, mealIdx) => (
                <td key={`total-${dayIdx}-${meal}`} className="border font-bold">
                  {getMealCount(addDays(startDay, dayIdx), meal)}
                </td>
              ))
            ))}
          </tr>
        </tbody>
      </table>
      <button
        className="mt-4 bg-green-500 text-white p-2 rounded"
        onClick={() => setNames([...names, { name: '', count: 1 }])}
      >
        添加员工
      </button>
    </div>
  );
};

export default MealPlanner;
